import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../lib/generated/prisma/client";

// Mirrors lib/auth/password.ts. The seed runs outside Next.js, so it cannot
// import that module: "server-only" throws outside a Next.js server context.
const BCRYPT_COST = 12;

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

  if (!email) {
    throw new Error("ADMIN_EMAIL is missing or empty. Set it in .env before seeding.");
  }

  if (!password) {
    throw new Error("ADMIN_PASSWORD is missing or empty. Set it in .env before seeding.");
  }

  if (!connectionString) {
    throw new Error("DATABASE_URL or DIRECT_URL must be set before seeding.");
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    // Upsert on the unique email, so re-running never creates a second admin.
    // The hash is refreshed on every run because the environment is the source
    // of truth for this credential: rotating ADMIN_PASSWORD and re-seeding is
    // the intended way to change it.
    const admin = await prisma.admin.upsert({
      where: { email },
      create: { email, passwordHash },
      update: { passwordHash },
      select: { id: true, email: true, createdAt: true, updatedAt: true },
    });

    const created = admin.createdAt.getTime() === admin.updatedAt.getTime();
    console.log(`Admin ${created ? "created" : "updated"}: ${admin.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
