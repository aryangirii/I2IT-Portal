import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { serverConfig } from "@/lib/config";
export const runtime = "nodejs";
function handler(
  req: Request,
  context: { params: Promise<{ nextauth: string[] }> },
) {
  serverConfig();
  return NextAuth(authOptions())(req, context);
}
export { handler as GET, handler as POST };
