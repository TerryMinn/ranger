"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/trpc/client";

export function AdminPostsPage() {
  const utils = trpc.useUtils();
  const postsQuery = trpc.post.adminList.useQuery({ limit: 100 });
  const deleteMutation = trpc.post.adminDelete.useMutation({
    onSuccess() {
      void utils.post.adminList.invalidate();
      void utils.dashboard.summary.invalidate();
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Admin
        </p>
        <h1 className="text-2xl font-semibold">Post list</h1>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-neutral-50 text-left">
            <tr>
              <th className="border-b border-neutral-200 p-3">Title</th>
              <th className="border-b border-neutral-200 p-3">Author</th>
              <th className="border-b border-neutral-200 p-3">Status</th>
              <th className="border-b border-neutral-200 p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {(postsQuery.data ?? []).map((post) => (
              <tr key={post.id}>
                <td className="border-b border-neutral-100 p-3">{post.title}</td>
                <td className="border-b border-neutral-100 p-3">
                  {post.author?.email || post.author?.name || "Unknown"}
                </td>
                <td className="border-b border-neutral-100 p-3">
                  {post.published ? "Published" : "Draft"}
                </td>
                <td className="border-b border-neutral-100 p-3 text-right">
                  <Button
                    variant="outline"
                    onClick={() => deleteMutation.mutate({ id: post.id })}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
