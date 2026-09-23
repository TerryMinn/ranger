import Constants from "expo-constants";
import { Platform } from "react-native";

const DEFAULT_PORT = "3000";
export const API_BASE_URL_PLACEHOLDER = "http://__ranger_api_base__";

function getConfiguredPort(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");

  return (
    configured?.match(/:(\d+)/)?.[1] ??
    process.env.EXPO_PUBLIC_API_PORT ??
    DEFAULT_PORT
  );
}

function getExpoDevHost(): string | undefined {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    return hostUri.replace(/^https?:\/\//, "").split(":")[0];
  }

  const debuggerHost = Constants.expoGoConfig?.debuggerHost;
  if (typeof debuggerHost === "string") {
    return debuggerHost.split(":")[0];
  }

  return undefined;
}

function isIosSimulator(): boolean {
  return Platform.OS === "ios" && Constants.isDevice === false;
}

function isAndroidEmulator(): boolean {
  return Platform.OS === "android" && Constants.isDevice === false;
}

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export function getApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  const port = getConfiguredPort();

  if (
    configured &&
    !configured.includes("localhost") &&
    !configured.includes("127.0.0.1")
  ) {
    return configured;
  }

  if (isIosSimulator()) {
    return "http://127.0.0.1:" + port;
  }

  if (isAndroidEmulator()) {
    return "http://10.0.2.2:" + port;
  }

  const devHost = getExpoDevHost();
  if (devHost && !isLoopbackHost(devHost)) {
    return "http://" + devHost + ":" + port;
  }

  return "http://127.0.0.1:" + port;
}

export function resolveTrpcFetchUrl(input: RequestInfo | URL): string {
  const baseUrl = getApiBaseUrl();
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  return raw.replace(API_BASE_URL_PLACEHOLDER, baseUrl);
}
