import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { serverConfig } from "@/lib/config";
export const runtime = "nodejs";
async function handler(
  req: Request,
  context: { params: Promise<{ nextauth: string[] }> },
) {
  serverConfig();
  const options = authOptions();
  let revocationFailed = false;
  const signOut = options.events!.signOut!;
  options.events!.signOut = async (message) => {
    try {
      await signOut(message);
    } catch (error) {
      revocationFailed = true;
      throw error;
    }
  };
  const response = await NextAuth(options)(req, context);
  // NextAuth catches event errors. Preserve the browser cookie on a failed
  // revocation, so the caller can retry logout instead of assuming it succeeded.
  if (revocationFailed)
    return Response.json(
      { error: "Sign out could not be completed. Please retry." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
export { handler as GET, handler as POST };
