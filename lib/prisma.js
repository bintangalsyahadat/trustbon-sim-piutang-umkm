import net from "node:net";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis;

// Node 18+ enables "happy eyeballs" (autoSelectFamily) by default. Against some
// dual-stack hosts (observed with Neon Postgres) one address family is a
// black hole: the TCP socket reports connected but the TLS handshake never
// completes, surfacing as ETIMEDOUT. Disabling it makes pg use the resolver's
// first address instead of racing both families.
if (typeof net.setDefaultAutoSelectFamily === "function") {
  net.setDefaultAutoSelectFamily(false);
}

function createPrismaClient() {
  // Prisma 7 removed the bundled Rust query engine — a driver adapter is now
  // required to connect. `PrismaPg` reads the Neon/Postgres connection string
  // (including `sslmode=require`) from DATABASE_URL.
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
