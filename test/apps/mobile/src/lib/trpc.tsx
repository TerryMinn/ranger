import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

import type { AppRouter } from "@repo/api";

import { getAuthRequestHeaders } from "./auth-headers";
import {
  API_BASE_URL_PLACEHOLDER,
  resolveTrpcFetchUrl,
} from "./get-api-base-url";

export const trpc = createTRPCReact<AppRouter>();

export function TRPCProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 2,
          },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          transformer: superjson,
          url: API_BASE_URL_PLACEHOLDER + "/api/trpc",
          fetch(input, init) {
            return fetch(resolveTrpcFetchUrl(input), {
              ...init,
              credentials: "omit",
            });
          },
          async headers() {
            return {
              "x-trpc-source": "expo-react-native",
              ...getAuthRequestHeaders(),
            };
          },
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
