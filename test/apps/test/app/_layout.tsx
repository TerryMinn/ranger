import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { TRPCProviderWrapper } from "../src/lib/trpc";

export default function RootLayout() {
  return (
    <TRPCProviderWrapper>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#ffffff" },
          headerTintColor: "#000000",
          contentStyle: { backgroundColor: "#ffffff" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Posts" }} />
        <Stack.Screen name="auth" options={{ title: "Auth", presentation: "modal" }} />
      </Stack>
      <StatusBar style="dark" />
    </TRPCProviderWrapper>
  );
}
