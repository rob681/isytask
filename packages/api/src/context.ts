import { db } from "@isytask/db";
import type { PrismaClient } from "@isytask/db";

export interface Session {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    agencyId: string;
    clientProfileId?: string;
    colaboradorProfileId?: string;
    permissions?: string[];
  };
}

export interface Context {
  db: PrismaClient;
  session: Session | null;
}

export function createContext(session: Session | null): Context {
  return {
    db: db as PrismaClient,
    session,
  };
}
