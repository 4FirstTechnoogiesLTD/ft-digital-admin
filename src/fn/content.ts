import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type DB = ReturnType<typeof getSupabaseServerClient>;

async function requireEditor() {
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: member } = await supabase
    .from("members")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member?.is_active || !["admin", "editor"].includes(member.role)) {
    throw new Error("You need editor access for this.");
  }
  return { supabase, user };
}

async function logAudit(
  supabase: DB,
  userId: string,
  action: string,
  entity: string,
  entityId: string | null,
  diff?: unknown,
) {
  await supabase.from("audit_log").insert({
    actor_user_id: userId,
    action,
    entity,
    entity_id: entityId,
    diff: (diff ?? null) as never,
  });
}

// ── index ──────────────────────────────────────────────────────────────────

export const getContentIndex = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = getSupabaseServerClient();
  const [{ data: pages }, { data: collections }, { data: items }] = await Promise.all([
    supabase.from("pages").select("slug, meta_title, is_published, published_at, updated_at"),
    supabase.from("collections").select("key, label, heading").order("key"),
    supabase.from("collection_items").select("collection_key, is_published"),
  ]);

  const counts = new Map<string, { total: number; published: number }>();
  for (const it of items ?? []) {
    const c = counts.get(it.collection_key) ?? { total: 0, published: 0 };
    c.total += 1;
    if (it.is_published) c.published += 1;
    counts.set(it.collection_key, c);
  }

  return {
    pages: (pages ?? []).sort((a, b) => a.slug.localeCompare(b.slug)),
    collections: (collections ?? []).map((c) => ({
      ...c,
      count: counts.get(c.key) ?? { total: 0, published: 0 },
    })),
  };
});

// ── pages ──────────────────────────────────────────────────────────────────

export const getPage = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    const { data: page } = await supabase
      .from("pages")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!page) throw new Error("Page not found");

    const { data: audit } = await supabase
      .from("audit_log")
      .select("id, action, created_at, actor_user_id")
      .eq("entity", "page")
      .eq("entity_id", data.slug)
      .order("created_at", { ascending: false })
      .limit(8);

    return { page, audit: audit ?? [] };
  });

const heroSchema = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  intro: z.array(z.string()).optional(),
  body: z.any().optional(),
});

export const savePage = createServerFn({ method: "POST" })
  .validator(
    z.object({
      slug: z.string(),
      meta_title: z.string().nullable(),
      meta_description: z.string().nullable(),
      og_title: z.string().nullable(),
      og_description: z.string().nullable(),
      canonical: z.string().nullable(),
      hero: heroSchema,
    }),
  )
  .handler(async ({ data }) => {
    const { supabase, user } = await requireEditor();
    const { error } = await supabase
      .from("pages")
      .update({
        meta_title: data.meta_title,
        meta_description: data.meta_description,
        og_title: data.og_title,
        og_description: data.og_description,
        canonical: data.canonical,
        hero: data.hero as never,
        updated_by: user.id,
      })
      .eq("slug", data.slug);
    if (error) throw error;
    await logAudit(supabase, user.id, "updated page", "page", data.slug);
    return { ok: true };
  });

export const setPagePublished = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string(), isPublished: z.boolean() }))
  .handler(async ({ data }) => {
    const { supabase, user } = await requireEditor();
    const { error } = await supabase
      .from("pages")
      .update({
        is_published: data.isPublished,
        published_at: data.isPublished ? new Date().toISOString() : null,
        updated_by: user.id,
      })
      .eq("slug", data.slug);
    if (error) throw error;
    await logAudit(
      supabase,
      user.id,
      data.isPublished ? "published page" : "unpublished page",
      "page",
      data.slug,
    );
    return { ok: true };
  });

// ── collections ────────────────────────────────────────────────────────────

export const getCollection = createServerFn({ method: "GET" })
  .validator(z.object({ key: z.string() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient();
    const [{ data: collection }, { data: items }] = await Promise.all([
      supabase.from("collections").select("*").eq("key", data.key).maybeSingle(),
      supabase
        .from("collection_items")
        .select("*")
        .eq("collection_key", data.key)
        .order("position", { ascending: true }),
    ]);
    if (!collection) throw new Error("Collection not found");
    return { collection, items: items ?? [] };
  });

export const saveCollectionMeta = createServerFn({ method: "POST" })
  .validator(
    z.object({
      key: z.string(),
      heading: z.string().nullable(),
      subheading: z.string().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabase, user } = await requireEditor();
    await supabase
      .from("collections")
      .update({ heading: data.heading, subheading: data.subheading })
      .eq("key", data.key);
    await logAudit(supabase, user.id, "updated collection", "collection", data.key);
    return { ok: true };
  });

export const upsertCollectionItem = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid().optional(),
      collection_key: z.string(),
      data: z.record(z.string(), z.any()),
      body_rich: z.any().nullable().optional(),
      is_published: z.boolean().default(true),
    }),
  )
  .handler(async ({ data }) => {
    const { supabase, user } = await requireEditor();

    if (data.id) {
      const { error } = await supabase
        .from("collection_items")
        .update({
          data: data.data as never,
          body_rich: (data.body_rich ?? null) as never,
          is_published: data.is_published,
          updated_by: user.id,
        })
        .eq("id", data.id);
      if (error) throw error;
      await logAudit(supabase, user.id, "updated item", "collection_item", data.id, {
        collection: data.collection_key,
      });
      return { id: data.id };
    }

    const { data: maxRow } = await supabase
      .from("collection_items")
      .select("position")
      .eq("collection_key", data.collection_key)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: inserted, error } = await supabase
      .from("collection_items")
      .insert({
        collection_key: data.collection_key,
        position: (maxRow?.position ?? -1) + 1,
        data: data.data as never,
        body_rich: (data.body_rich ?? null) as never,
        is_published: data.is_published,
        updated_by: user.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    await logAudit(supabase, user.id, "added item", "collection_item", inserted.id, {
      collection: data.collection_key,
    });
    return { id: inserted.id };
  });

export const deleteCollectionItem = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabase, user } = await requireEditor();
    await supabase.from("collection_items").delete().eq("id", data.id);
    await logAudit(supabase, user.id, "deleted item", "collection_item", data.id);
    return { ok: true };
  });

export const reorderCollection = createServerFn({ method: "POST" })
  .validator(z.object({ key: z.string(), orderedIds: z.array(z.string().uuid()) }))
  .handler(async ({ data }) => {
    const { supabase, user } = await requireEditor();
    await Promise.all(
      data.orderedIds.map((id, i) =>
        supabase.from("collection_items").update({ position: i }).eq("id", id),
      ),
    );
    await logAudit(supabase, user.id, "reordered", "collection", data.key);
    return { ok: true };
  });

// ── site settings ──────────────────────────────────────────────────────────

export const getSiteSettings = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("site_settings")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
});

export const saveSiteSettings = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().uuid().optional(),
      contact_email: z.string().nullable(),
      contact_phone: z.string().nullable(),
      linkedin_url: z.string().nullable(),
      studio_address: z.string().nullable(),
      hours: z.string().nullable(),
      footer_tagline: z.string().nullable(),
      og_image_url: z.string().nullable(),
      metrics: z.array(z.object({ n: z.string(), l: z.string() })),
      ticker: z.array(z.string()),
      socials: z.array(z.object({ label: z.string(), href: z.string() })),
    }),
  )
  .handler(async ({ data }) => {
    const { supabase, user } = await requireEditor();
    const patch = {
      contact_email: data.contact_email,
      contact_phone: data.contact_phone,
      linkedin_url: data.linkedin_url,
      studio_address: data.studio_address,
      hours: data.hours,
      footer_tagline: data.footer_tagline,
      og_image_url: data.og_image_url,
      metrics: data.metrics as never,
      ticker: data.ticker as never,
      socials: data.socials as never,
      updated_by: user.id,
    };
    if (data.id) {
      await supabase.from("site_settings").update(patch).eq("id", data.id);
    } else {
      await supabase.from("site_settings").insert(patch as never);
    }
    await logAudit(supabase, user.id, "updated site settings", "site_settings", data.id ?? null);
    return { ok: true };
  });

// ── media ──────────────────────────────────────────────────────────────────

export const listMedia = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("media")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
});

export const recordMedia = createServerFn({ method: "POST" })
  .validator(
    z.object({
      path: z.string(),
      url: z.string(),
      alt: z.string().optional(),
      size: z.number().optional(),
      content_type: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabase, user } = await requireEditor();
    const { data: row, error } = await supabase
      .from("media")
      .insert({ ...data, uploaded_by: user.id })
      .select("*")
      .single();
    if (error) throw error;
    await logAudit(supabase, user.id, "uploaded media", "media", row.id);
    return row;
  });

export const updateMediaAlt = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid(), alt: z.string() }))
  .handler(async ({ data }) => {
    const { supabase } = await requireEditor();
    await supabase.from("media").update({ alt: data.alt }).eq("id", data.id);
    return { ok: true };
  });

export const deleteMedia = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid(), path: z.string() }))
  .handler(async ({ data }) => {
    const { supabase, user } = await requireEditor();
    await supabase.storage.from("media").remove([data.path]);
    await supabase.from("media").delete().eq("id", data.id);
    await logAudit(supabase, user.id, "deleted media", "media", data.id);
    return { ok: true };
  });
