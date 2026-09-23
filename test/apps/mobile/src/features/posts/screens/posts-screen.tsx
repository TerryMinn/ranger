import { Image } from "expo-image";
import { router } from "expo-router";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { PostCard } from "../components/post-card";
import { usePostsViewModel } from "../hooks/use-posts-view-model";

export function PostsScreen() {
  const vm = usePostsViewModel();

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={vm.posts}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.eyebrow}>RANGER APP</Text>
              <Text style={styles.screenTitle}>Posts</Text>
            </View>
            {vm.isAuthed ? (
              <Pressable style={styles.outlineButton} onPress={vm.signOut}>
                <Text style={styles.outlineButtonText}>Sign out</Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.outlineButton}
                onPress={() => router.push("/auth")}
              >
                <Text style={styles.outlineButtonText}>Sign in</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.form}>
            <Text style={styles.formTitle}>Create post</Text>
            <TextInput
              value={vm.title}
              onChangeText={vm.setTitle}
              placeholder="Post title"
              placeholderTextColor="#737373"
              style={styles.input}
            />
            <TextInput
              value={vm.content}
              onChangeText={vm.setContent}
              placeholder="Write something"
              placeholderTextColor="#737373"
              multiline
              style={[styles.input, styles.textarea]}
            />
            {vm.localImageUri ? (
              <Image source={{ uri: vm.localImageUri }} style={styles.preview} />
            ) : null}
            <View style={styles.actions}>
              <Pressable style={styles.outlineButton} onPress={vm.pickImage}>
                <Text style={styles.outlineButtonText}>Image</Text>
              </Pressable>
              <Pressable
                style={[styles.button, (!vm.title.trim() || vm.isCreating) && styles.disabled]}
                disabled={!vm.title.trim() || vm.isCreating}
                onPress={vm.createPost}
              >
                <Text style={styles.buttonText}>
                  {vm.isCreating ? "Publishing..." : "Publish"}
                </Text>
              </Pressable>
            </View>
            {vm.errorMessage ? <Text style={styles.error}>{vm.errorMessage}</Text> : null}
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <PostCard
          title={item.title}
          content={item.content}
          imageUrl={item.imageUrl}
          authorName={item.author?.name}
        />
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={
        vm.isLoading ? (
          <Text style={styles.muted}>Loading posts...</Text>
        ) : (
          <Text style={styles.muted}>No posts yet.</Text>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    padding: 18,
    gap: 14,
  },
  header: {
    gap: 18,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  eyebrow: {
    color: "#525252",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0,
  },
  screenTitle: {
    color: "#000000",
    fontSize: 30,
    fontWeight: "700",
  },
  form: {
    borderWidth: 1,
    borderColor: "#d4d4d4",
    borderRadius: 8,
    padding: 14,
    gap: 12,
  },
  formTitle: {
    color: "#000000",
    fontSize: 18,
    fontWeight: "700",
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "#d4d4d4",
    borderRadius: 8,
    paddingHorizontal: 12,
    color: "#000000",
    backgroundColor: "#ffffff",
  },
  textarea: {
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  preview: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#000000",
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  outlineButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d4d4d4",
    paddingHorizontal: 14,
    backgroundColor: "#ffffff",
  },
  outlineButtonText: {
    color: "#000000",
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.5,
  },
  error: {
    color: "#262626",
    backgroundColor: "#f5f5f5",
    borderColor: "#d4d4d4",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  separator: {
    height: 14,
  },
  muted: {
    color: "#737373",
    textAlign: "center",
    paddingVertical: 24,
  },
});
