import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { fetchSessionMember } from "@/fn/auth";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    const member = await fetchSessionMember();
    if (!member) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    return { member };
  },
  loader: ({ context }) => ({ member: context.member }),
  component: AppLayout,
});

function AppLayout() {
  const { member } = Route.useLoaderData();
  return (
    <AppShell member={member}>
      <Outlet />
    </AppShell>
  );
}
