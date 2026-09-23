"use client";

import { Card } from "@/components/ui/card";
import { trpc } from "@/trpc/client";

export function AdminDashboard() {
  const summaryQuery = trpc.dashboard.summary.useQuery();
  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Admin
        </p>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-neutral-500">Posts</p>
          <p className="mt-2 text-3xl font-semibold">{summary?.postCount ?? 0}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-neutral-500">Published</p>
          <p className="mt-2 text-3xl font-semibold">
            {summary?.publishedPostCount ?? 0}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-neutral-500">Users</p>
          <p className="mt-2 text-3xl font-semibold">{summary?.userCount ?? 0}</p>
        </Card>
      </section>

      <Card className="p-5">
        <h2 className="mb-4 text-lg font-semibold">Latest posts</h2>
        <div className="divide-y divide-neutral-200">
          {(summary?.latestPosts ?? []).map((post) => (
            <div key={post.id} className="flex items-center justify-between py-3 text-sm">
              <span>{post.title}</span>
              <span className="text-neutral-500">
                {post.author?.email || post.author?.name || "Unknown"}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
