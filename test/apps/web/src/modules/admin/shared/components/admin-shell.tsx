"use client";

import { Button, buttonClassName } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { AppLink } from "@/lib/navigation";
import { trpc } from "@/trpc/client";

function isDashboardRole(role: string | null | undefined) {
  return ["admin", "owner", "manager", "staff"].includes(role ?? "");
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const meQuery = trpc.user.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  async function signOut() {
    await authClient.signOut();
    window.location.href = "/login";
  }

  if (meQuery.isLoading) {
    return <main className="p-8 text-sm text-neutral-500">Loading admin...</main>;
  }

  const adminUser = meQuery.data;

  if (!adminUser || !isDashboardRole(adminUser.role)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6 text-black">
        <h1 className="text-2xl font-semibold">Admin access required</h1>
        <p className="text-sm text-neutral-600">
          Sign in with an admin, owner, manager, or staff account.
        </p>
        <AppLink to="/login?callbackUrl=/admin" className={buttonClassName()}>
          Sign in
        </AppLink>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-neutral-200 p-5 md:block">
        <AppLink to="/" className="text-lg font-semibold">
          Ranger
        </AppLink>
        <nav className="mt-8 grid gap-2 text-sm">
          <AppLink className="rounded-md px-3 py-2 hover:bg-neutral-100" to="/admin">
            Dashboard
          </AppLink>
          <AppLink className="rounded-md px-3 py-2 hover:bg-neutral-100" to="/admin/posts">
            Posts
          </AppLink>
          <AppLink className="rounded-md px-3 py-2 hover:bg-neutral-100" to="/admin/users">
            Users
          </AppLink>
        </nav>
      </aside>
      <div className="md:pl-64">
        <header className="flex h-16 items-center justify-between border-b border-neutral-200 px-6">
          <div className="flex gap-3 text-sm md:hidden">
            <AppLink to="/admin">Dashboard</AppLink>
            <AppLink to="/admin/posts">Posts</AppLink>
            <AppLink to="/admin/users">Users</AppLink>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-neutral-600">{adminUser.email}</span>
            <Button variant="outline" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
