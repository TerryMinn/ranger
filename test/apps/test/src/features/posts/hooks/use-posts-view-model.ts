import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { authClient } from "../../../lib/auth-client";
import { trpc } from "../../../lib/trpc";
import { uploadImage } from "../../../lib/upload-image";

export function usePostsViewModel() {
  const utils = trpc.useUtils();
  const { data: session } = authClient.useSession();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [imageAsset, setImageAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const postsQuery = trpc.post.getAll.useQuery({ limit: 50 });
  const meQuery = trpc.user.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  useFocusEffect(
    useCallback(() => {
      void meQuery.refetch();
    }, [meQuery]),
  );

  const isAuthed = Boolean(meQuery.data ?? session?.user);

  const createMutation = trpc.post.create.useMutation({
    onSuccess() {
      setTitle("");
      setContent("");
      setLocalImageUri(null);
      setImageAsset(null);
      void utils.post.getAll.invalidate();
      void utils.post.getMyPosts.invalidate();
    },
  });

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setErrorMessage("Photo library permission is required.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    setImageAsset(result.assets[0]);
    setLocalImageUri(result.assets[0].uri);
  }

  async function createPost() {
    if (!isAuthed) {
      router.push("/auth");
      return;
    }

    setErrorMessage(null);

    try {
      const imageUrl = imageAsset
        ? await uploadImage({
            folder: "posts",
            uri: imageAsset.uri,
            mimeType: imageAsset.mimeType ?? "image/jpeg",
            fileName: imageAsset.fileName ?? undefined,
          })
        : undefined;

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
  }

  return {
    posts: postsQuery.data?.posts ?? [],
    isLoading: postsQuery.isLoading,
    isAuthed,
    title,
    setTitle,
    content,
    setContent,
    localImageUri,
    errorMessage,
    isCreating: createMutation.isPending,
    pickImage,
    createPost,
    signOut,
  };
}
