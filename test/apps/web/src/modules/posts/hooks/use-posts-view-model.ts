"use client";

import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { getApiBaseUrl } from "@/lib/api-url";
import { trpc } from "@/trpc/client";

async function uploadImage(file: File) {
  const formData = new FormData();
  formData.append("folder", "posts");
  formData.append("file", file);

  const response = await fetch(getApiBaseUrl() + "/api/uploads", {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error || "Image upload failed.");
  }

  const payload = (await response.json()) as { url: string };
  return payload.url;
}

export function usePostsViewModel() {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const postsQuery = trpc.post.getAll.useQuery({ limit: 50 });
  const meQuery = trpc.user.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const createMutation = trpc.post.create.useMutation({
    onSuccess() {
      setTitle("");
      setContent("");
      setImageFile(null);
      void utils.post.getAll.invalidate();
      void utils.post.getMyPosts.invalidate();
    },
  });

  async function createPost() {
    setErrorMessage(null);

    try {
      const imageUrl = imageFile ? await uploadImage(imageFile) : undefined;
      await createMutation.mutateAsync({
        title,
        content,
        imageUrl,
        published: true,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create post.",
      );
    }
  }

  async function signOut() {
    await authClient.signOut();
    await utils.user.me.invalidate();
    await meQuery.refetch();
  }

  return {
    posts: postsQuery.data?.posts ?? [],
    isLoading: postsQuery.isLoading,
    isAuthed: Boolean(meQuery.data),
    title,
    setTitle,
    content,
    setContent,
    setImageFile,
    errorMessage,
    isCreating: createMutation.isPending,
    createPost,
    signOut,
  };
}
