"use client";

import { Button, buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AppLink } from "@/lib/navigation";

import { usePostsViewModel } from "../hooks/use-posts-view-model";

export function PostsPage() {
  const vm = usePostsViewModel();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-8 text-black">
      <header className="flex flex-col gap-4 border-b border-neutral-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Ranger App
          </p>
          <h1 className="text-3xl font-semibold">Posts</h1>
        </div>
        <nav className="flex gap-2">
          <AppLink to="/admin" className={buttonClassName("outline")}>
            Admin
          </AppLink>
          {vm.isAuthed ? (
            <Button variant="ghost" onClick={vm.signOut}>
              Sign out
            </Button>
          ) : (
            <AppLink to="/login" className={buttonClassName()}>
              Sign in
            </AppLink>
          )}
        </nav>
      </header>

      <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="p-5">
          <h2 className="mb-4 text-lg font-semibold">Create post</h2>
          {vm.isAuthed ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void vm.createPost();
              }}
            >
              <Input
                value={vm.title}
                onChange={(event) => vm.setTitle(event.target.value)}
                placeholder="Post title"
              />
              <Textarea
                value={vm.content}
                onChange={(event) => vm.setContent(event.target.value)}
                placeholder="Write something"
              />
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) =>
                  vm.setImageFile(event.target.files?.[0] ?? null)
                }
              />
              {vm.errorMessage ? (
                <p className="text-sm text-neutral-700">{vm.errorMessage}</p>
              ) : null}
              <Button type="submit" disabled={vm.isCreating || !vm.title.trim()}>
                {vm.isCreating ? "Publishing..." : "Publish"}
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-neutral-600">
                Sign in before creating a post or uploading an image.
              </p>
              <AppLink to="/login" className={buttonClassName()}>
                Sign in
              </AppLink>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          {vm.isLoading ? <p className="text-sm text-neutral-500">Loading posts...</p> : null}
          {vm.posts.map((post) => (
            <Card key={post.id} className="overflow-hidden">
              {post.imageUrl ? (
                <div className="relative aspect-[16/9] w-full bg-neutral-100">
                  <img
                    src={post.imageUrl}
                    alt={post.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}
              <div className="space-y-2 p-5">
                <h2 className="text-xl font-semibold">{post.title}</h2>
                {post.content ? (
                  <p className="text-sm leading-6 text-neutral-700">{post.content}</p>
                ) : null}
                <p className="text-xs text-neutral-500">
                  By {post.author?.name || "Unknown"}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
