import { Link, useRouterState, useRouter } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Mail,
  FileText,
  Layers,
  Image as ImageIcon,
  Settings,
  Users,
  AtSign,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { SessionMember } from "@/fn/auth";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Mail;
  minRole?: "editor" | "admin";
  exact?: boolean;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    section: "Mailbox",
    items: [{ to: "/mail", label: "Mail", icon: Mail }],
  },
  {
    section: "Content",
    items: [
      {
        to: "/content",
        label: "Pages & Collections",
        icon: FileText,
        minRole: "editor",
        exact: true,
      },
      { to: "/content/media", label: "Media", icon: ImageIcon, minRole: "editor" },
    ],
  },
  {
    section: "Settings",
    items: [
      { to: "/settings/site", label: "Site settings", icon: Settings, minRole: "editor" },
      { to: "/settings/members", label: "Members", icon: Users, minRole: "admin" },
      { to: "/settings/mail", label: "Mail domain", icon: AtSign, minRole: "admin" },
    ],
  },
];

const roleRank = { member: 0, editor: 1, admin: 2 } as const;

export function AppShell({ member, children }: { member: SessionMember; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-background">
      {/* mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:hidden">
        <span className="text-sm font-medium tracking-tight">
          4First<span className="text-muted-foreground"> / Admin</span>
        </span>
        <button onClick={() => setOpen((v) => !v)} aria-label="Toggle navigation">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      <Sidebar member={member} open={open} onNavigate={() => setOpen(false)} />

      <main className="flex-1 pt-14 md:pt-0 md:pl-64">{children}</main>
    </div>
  );
}

function Sidebar({
  member,
  open,
  onNavigate,
}: {
  member: SessionMember;
  open: boolean;
  onNavigate: () => void;
}) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function handleSignOut() {
    await getSupabaseBrowserClient().auth.signOut();
    await router.invalidate();
    router.navigate({ to: "/login" });
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border bg-sidebar transition-transform md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <span className="grid size-8 place-items-center rounded-full bg-signal text-signal-foreground text-sm font-semibold">
          4F
        </span>
        <span className="text-sm font-medium tracking-tight">
          4First<span className="text-muted-foreground"> / Admin</span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {NAV.map((group) => {
          const items = group.items.filter(
            (it) => !it.minRole || roleRank[member.role] >= roleRank[it.minRole],
          );
          if (!items.length) return null;
          return (
            <div key={group.section} className="mb-6">
              <div className="text-mono-label px-2 mb-2">{group.section}</div>
              <ul className="space-y-0.5">
                {items.map((it) => {
                  const active = it.exact
                    ? pathname === it.to
                    : pathname === it.to || pathname.startsWith(it.to + "/");
                  const Icon = it.icon;
                  return (
                    <li key={it.to}>
                      <Link
                        to={it.to}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
                          active
                            ? "bg-surface-2 text-foreground"
                            : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        {it.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-medium uppercase">
            {(member.fullName || member.email).slice(0, 2)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm">{member.fullName || member.email}</div>
            <div className="text-mono-label truncate">{member.role}</div>
          </div>
          <button
            onClick={handleSignOut}
            aria-label="Sign out"
            className="text-muted-foreground transition-colors hover:text-destructive"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export { Layers };
