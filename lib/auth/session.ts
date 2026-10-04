import { getServerSession } from "next-auth";
import { authOptions } from "./options";
import { adminEmails, demoEnabled, serverConfig } from "@/lib/config";
export interface Actor {
  userId: string;
  email: string;
  displayName: string;
  admin: boolean;
}
export async function currentActor(): Promise<Actor | null> {
  serverConfig();
  const session = await getServerSession(authOptions());
  if (!session?.user?.email) return null;
  const email = session.user.email.toLowerCase();
  return {
    userId: email,
    email,
    displayName: session.user.name ?? email,
    admin:
      adminEmails().includes(email) ||
      (demoEnabled() && email === "demo-admin@example.com"),
  };
}
