"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthViewModel } from "../hooks/use-auth-view-model";

export function LoginPage() {
  const vm = useAuthViewModel();

  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-6 text-black">
      <Card className="w-full max-w-md p-6">
        <div className="mb-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
            {vm.mode === "login" ? "Welcome back" : "Create account"}
          </p>
          <h1 className="text-2xl font-semibold">Sign in to your workspace</h1>
        </div>

        <form onSubmit={(event) => { event.preventDefault(); void vm.submit(); }} className="space-y-4">
          {vm.mode === "register" ? (
            <Input
              value={vm.name}
              onChange={(event) => vm.setName(event.target.value)}
              placeholder="Name"
            />
          ) : null}
          <Input
            value={vm.email}
            onChange={(event) => vm.setEmail(event.target.value)}
            placeholder="Email"
            type="email"
          />
          <Input
            value={vm.password}
            onChange={(event) => vm.setPassword(event.target.value)}
            placeholder="Password"
            type="password"
          />
          {vm.errorMessage ? (
            <p className="rounded-md border border-neutral-300 bg-neutral-50 p-3 text-sm text-neutral-800">
              {vm.errorMessage}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={vm.isPending}>
            {vm.isPending ? "Please wait..." : vm.mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <Button
          variant="ghost"
          className="mt-4 w-full"
          onClick={() => vm.setMode(vm.mode === "login" ? "register" : "login")}
        >
          {vm.mode === "login" ? "Create a new account" : "Use an existing account"}
        </Button>
      </Card>
    </main>
  );
}
