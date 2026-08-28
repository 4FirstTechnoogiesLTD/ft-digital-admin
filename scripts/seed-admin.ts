/**
 * Create the first admin member (or promote an existing user).
 *
 *   bun run seed-admin -- --email you@company.com --name "Your Name" [--password ...]
 *
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + MAIL_DOMAIN from .env.
 * Idempotent: re-running updates the role/mailbox instead of erroring.
 */
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile();
} catch {
  /* .env optional if vars already exported */
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const email = arg("email");
const name = arg("name") ?? email?.split("@")[0] ?? "Admin";
const password = arg("password") ?? cryptoRandom();
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const mailDomain = process.env.MAIL_DOMAIN ?? "mail.4firsttech.com";

if (!email) {
  console.error("Usage: bun run seed-admin -- --email you@company.com --name \"Your Name\"");
  process.exit(1);
}
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set them in .env).");
  process.exit(1);
}

function cryptoRandom() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  // find or create the auth user
  const list = await supabase.auth.admin.listUsers({ perPage: 200 });
  let user = list.data.users.find((u) => u.email?.toLowerCase() === email!.toLowerCase());

  if (!user) {
    const created = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (created.error) throw created.error;
    user = created.data.user!;
    console.log(`Created auth user ${email}`);
    console.log(`Temporary password: ${password}`);
  } else {
    if (arg("password")) {
      await supabase.auth.admin.updateUserById(user.id, { password });
      console.log("Password updated.");
    }
    console.log(`Found existing auth user ${email}`);
  }

  const { error: mErr } = await supabase
    .from("members")
    .upsert(
      { user_id: user.id, full_name: name, role: "admin", is_active: true },
      { onConflict: "user_id" },
    );
  if (mErr) throw mErr;

  const address = `${email!.split("@")[0].replace(/[^a-z0-9._-]/gi, "").toLowerCase()}@${mailDomain}`;
  const { error: bErr } = await supabase
    .from("mailboxes")
    .upsert(
      { user_id: user.id, address, display_name: name },
      { onConflict: "user_id" },
    );
  if (bErr) throw bErr;

  console.log(`\n✔ ${email} is now an admin.`);
  console.log(`  Mailbox: ${address}`);
  console.log(`  Sign in at /login`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
