import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@localhost";
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password) {
    throw new Error(
      "Set SEED_ADMIN_PASSWORD in the root .env before running db:seed.",
    );
  }

  const passwordHash = await hashPassword(password);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name: "Super Admin",
      emailVerified: true,
      role: "admin",
      banned: false,
      banReason: null,
      banExpires: null,
    },
    create: {
      email,
      name: "Super Admin",
      emailVerified: true,
      role: "admin",
      banned: false,
      banReason: null,
      banExpires: null,
    },
  });

  await prisma.account.upsert({
    where: {
      providerId_accountId: {
        providerId: "credential",
        accountId: admin.id,
      },
    },
    update: {
      userId: admin.id,
      password: passwordHash,
    },
    create: {
      userId: admin.id,
      providerId: "credential",
      accountId: admin.id,
      password: passwordHash,
    },
  });

  await prisma.post.upsert({
    where: { id: "seed-welcome-post" },
    update: {},
    create: {
      id: "seed-welcome-post",
      title: "Welcome to Test",
      content: "This post was created by the seed script.",
      published: true,
      authorId: admin.id,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Prisma seed failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
