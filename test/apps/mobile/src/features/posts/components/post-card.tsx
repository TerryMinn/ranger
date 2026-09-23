import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

type PostCardProps = {
  title: string;
  content?: string | null;
  imageUrl?: string | null;
  authorName?: string | null;
};

export function PostCard({
  title,
  content,
  imageUrl,
  authorName,
}: PostCardProps) {
  return (
    <View style={styles.card}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.image} /> : null}
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {content ? <Text style={styles.content}>{content}</Text> : null}
        <Text style={styles.meta}>By {authorName || "Unknown"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "#d4d4d4",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  image: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#f5f5f5",
  },
  body: {
    padding: 14,
    gap: 8,
  },
  title: {
    color: "#000000",
    fontSize: 18,
    fontWeight: "700",
  },
  content: {
    color: "#404040",
    lineHeight: 20,
  },
  meta: {
    color: "#737373",
    fontSize: 12,
  },
});
