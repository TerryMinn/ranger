"use client";

import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { useAppNavigation } from "@/lib/navigation";

export function useAuthViewModel() {
  const navigation = useAppNavigation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function submit() {
    setErrorMessage(null);
    setIsPending(true);

    try {
      const result = mode === "login"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({
            email,
            password,
            name: name.trim() || email.split("@")[0] || "User",
          });

      if (result.error) {
        setErrorMessage(result.error.message || "Authentication failed.");
        return;
      }

      navigation.navigate(navigation.getSearchParam("callbackUrl") || "/");
      navigation.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Authentication failed.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return {
    mode,
    setMode,
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    errorMessage,
    isPending,
    submit,
  };
}
