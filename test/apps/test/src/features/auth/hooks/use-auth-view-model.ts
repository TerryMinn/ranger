import { router } from "expo-router";
import { useState } from "react";

import { authClient } from "../../../lib/auth-client";
import { trpc } from "../../../lib/trpc";

export function useAuthViewModel() {
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function submit() {
    setErrorMessage(null);
    setIsPending(true);

    const result =
      mode === "login"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({
            email,
            password,
            name: name.trim() || email.split("@")[0] || "User",
          });

    setIsPending(false);

    if (result.error) {
      setErrorMessage(result.error.message || "Authentication failed.");
      return;
    }

    await utils.user.me.invalidate();
    router.back();
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
