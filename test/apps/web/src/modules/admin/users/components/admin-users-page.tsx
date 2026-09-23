"use client";

import { Card } from "@/components/ui/card";
import { trpc } from "@/trpc/client";

export function AdminUsersPage() {
  const usersQuery = trpc.user.adminList.useQuery({ limit: 100 });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Admin
        </p>
        <h1 className="text-2xl font-semibold">User list</h1>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-neutral-50 text-left">
            <tr>
              <th className="border-b border-neutral-200 p-3">Name</th>
              <th className="border-b border-neutral-200 p-3">Email</th>
              <th className="border-b border-neutral-200 p-3">Role</th>
            </tr>
          </thead>
          <tbody>
            {(usersQuery.data ?? []).map((user) => (
              <tr key={user.id}>
                <td className="border-b border-neutral-100 p-3">
                  {user.name || "Unnamed"}
                </td>
                <td className="border-b border-neutral-100 p-3">{user.email}</td>
                <td className="border-b border-neutral-100 p-3">
                  {user.role || "user"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
