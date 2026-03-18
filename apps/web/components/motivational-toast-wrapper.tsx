"use client";

import { useSession } from "next-auth/react";
import { MotivationalToast } from "./motivational-toast";

/** Only renders MotivationalToast for ADMIN and COLABORADOR roles */
export function MotivationalToastWrapper() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;

  if (role !== "ADMIN" && role !== "COLABORADOR") return null;

  return <MotivationalToast />;
}
