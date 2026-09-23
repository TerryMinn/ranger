import { auth } from "./auth";

export type Session = {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    role: string | null;
  };
};

export async function getSession(headers: Headers): Promise<Session | null> {
  const result = await auth.api.getSession({ headers });

  if (!result) {
    return null;
  }

  const user = result.user as typeof result.user & {
    role?: string | null;
  };

  return {
    user: {
      id: user.id,
      name: user.name ?? null,
      email: user.email ?? null,
      image: user.image ?? null,
      role: user.role ?? null,
    },
  };
}
