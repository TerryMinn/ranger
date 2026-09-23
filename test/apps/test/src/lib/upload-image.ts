import { getAuthRequestHeaders } from "./auth-headers";
import { getApiBaseUrl } from "./get-api-base-url";

type UploadImageParams = {
  folder: "posts" | "avatars";
  uri: string;
  mimeType?: string;
  fileName?: string;
};

function getExtension(mimeType?: string, fileName?: string) {
  if (fileName?.includes(".")) {
    return fileName.split(".").pop()?.toLowerCase() ?? "jpg";
  }

  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "jpg";
  }
}

export async function uploadImage({
  folder,
  uri,
  mimeType = "image/jpeg",
  fileName,
}: UploadImageParams): Promise<string> {
  const extension = getExtension(mimeType, fileName);
  const formData = new FormData();

  formData.append("folder", folder);
  formData.append(
    "file",
    {
      uri,
      name: fileName ?? "upload." + extension,
      type: mimeType,
    } as unknown as Blob,
  );

  const response = await fetch(getApiBaseUrl() + "/api/uploads", {
    method: "POST",
    credentials: "omit",
    headers: getAuthRequestHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error || "Image upload failed.");
  }

  const payload = (await response.json()) as { url?: string };
  if (!payload.url) {
    throw new Error("Upload did not return a URL.");
  }

  return payload.url;
}
