/**
 * Hand-authored to match supabase/migrations. Regenerate with:
 *   bunx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 * once the project is linked. Kept in sync manually until then.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MemberRole = "admin" | "editor" | "member";
export type SubmissionStatus = "new" | "read" | "archived";
export type MailDirection = "inbound" | "outbound";
export type MailFolder = "inbox" | "sent" | "drafts" | "archive" | "trash" | "spam";

export interface Database {
  public: {
    Tables: {
      members: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          role: MemberRole;
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name: string;
          role?: MemberRole;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["members"]["Insert"]>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          actor_user_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          diff: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          diff?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Insert"]>;
        Relationships: [];
      };
      site_settings: {
        Row: {
          id: string;
          contact_email: string | null;
          contact_phone: string | null;
          linkedin_url: string | null;
          studio_address: string | null;
          hours: string | null;
          footer_tagline: string | null;
          og_image_url: string | null;
          metrics: Json;
          ticker: Json;
          socials: Json;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["site_settings"]["Row"]> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["site_settings"]["Row"]>;
        Relationships: [];
      };
      pages: {
        Row: {
          slug: string;
          meta_title: string | null;
          meta_description: string | null;
          og_title: string | null;
          og_description: string | null;
          canonical: string | null;
          hero: Json;
          draft: Json | null;
          is_published: boolean;
          published_at: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: { slug: string } & Partial<Database["public"]["Tables"]["pages"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["pages"]["Row"]>;
        Relationships: [];
      };
      collections: {
        Row: {
          key: string;
          label: string;
          heading: string | null;
          subheading: string | null;
          item_shape: string;
          updated_at: string;
        };
        Insert: { key: string; label: string; item_shape: string } & Partial<
          Database["public"]["Tables"]["collections"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["collections"]["Row"]>;
        Relationships: [];
      };
      collection_items: {
        Row: {
          id: string;
          collection_key: string;
          position: number;
          data: Json;
          body_rich: Json | null;
          is_published: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: { collection_key: string } & Partial<
          Database["public"]["Tables"]["collection_items"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["collection_items"]["Row"]>;
        Relationships: [];
      };
      media: {
        Row: {
          id: string;
          path: string;
          url: string;
          alt: string | null;
          width: number | null;
          height: number | null;
          size: number | null;
          content_type: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: { path: string; url: string } & Partial<
          Database["public"]["Tables"]["media"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["media"]["Row"]>;
        Relationships: [];
      };
      contact_submissions: {
        Row: {
          id: string;
          name: string;
          email: string;
          company: string | null;
          interests: string[];
          brief: string;
          status: SubmissionStatus;
          assigned_to: string | null;
          created_at: string;
        };
        Insert: { name: string; email: string; brief: string } & Partial<
          Database["public"]["Tables"]["contact_submissions"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["contact_submissions"]["Row"]>;
        Relationships: [];
      };
      mailboxes: {
        Row: {
          id: string;
          user_id: string;
          address: string;
          display_name: string;
          signature_rich: Json | null;
          created_at: string;
        };
        Insert: { user_id: string; address: string; display_name: string } & Partial<
          Database["public"]["Tables"]["mailboxes"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["mailboxes"]["Row"]>;
        Relationships: [];
      };
      threads: {
        Row: {
          id: string;
          mailbox_id: string;
          subject: string;
          snippet: string | null;
          last_message_at: string;
          message_count: number;
          unread_count: number;
          is_starred: boolean;
          folder: MailFolder;
          labels: string[];
          created_at: string;
        };
        Insert: { mailbox_id: string; subject: string } & Partial<
          Database["public"]["Tables"]["threads"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["threads"]["Row"]>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          thread_id: string;
          mailbox_id: string;
          direction: MailDirection;
          resend_email_id: string | null;
          message_id: string | null;
          in_reply_to: string | null;
          references: string[];
          from_addr: string;
          from_name: string | null;
          to_addrs: Json;
          cc_addrs: Json;
          bcc_addrs: Json;
          subject: string;
          html: string | null;
          text: string | null;
          headers: Json | null;
          folder: MailFolder;
          is_read: boolean;
          is_starred: boolean;
          has_attachments: boolean;
          sent_at: string | null;
          received_at: string | null;
          raw_download_url: string | null;
          created_at: string;
        };
        Insert: {
          thread_id: string;
          mailbox_id: string;
          direction: MailDirection;
          from_addr: string;
          subject: string;
        } & Partial<Database["public"]["Tables"]["messages"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["messages"]["Row"]>;
        Relationships: [];
      };
      attachments: {
        Row: {
          id: string;
          message_id: string;
          resend_attachment_id: string | null;
          filename: string;
          content_type: string | null;
          size: number | null;
          storage_path: string | null;
          content_id: string | null;
          disposition: string | null;
          created_at: string;
        };
        Insert: { message_id: string; filename: string } & Partial<
          Database["public"]["Tables"]["attachments"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["attachments"]["Row"]>;
        Relationships: [];
      };
      drafts: {
        Row: {
          id: string;
          mailbox_id: string;
          to_addrs: Json;
          cc_addrs: Json;
          bcc_addrs: Json;
          subject: string;
          body_rich: Json | null;
          in_reply_to_message_id: string | null;
          updated_at: string;
        };
        Insert: { mailbox_id: string } & Partial<Database["public"]["Tables"]["drafts"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["drafts"]["Row"]>;
        Relationships: [];
      };
      labels: {
        Row: {
          id: string;
          mailbox_id: string;
          name: string;
          color: string;
          created_at: string;
        };
        Insert: { mailbox_id: string; name: string } & Partial<
          Database["public"]["Tables"]["labels"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["labels"]["Row"]>;
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          mailbox_id: string;
          name: string | null;
          email: string;
          last_contacted_at: string | null;
          created_at: string;
        };
        Insert: { mailbox_id: string; email: string } & Partial<
          Database["public"]["Tables"]["contacts"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["contacts"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      member_role: MemberRole;
      submission_status: SubmissionStatus;
      mail_direction: MailDirection;
      mail_folder: MailFolder;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
