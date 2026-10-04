import { Welcome } from "@/components/portal/welcome";
import { currentActor } from "@/lib/auth/session";
import { demoEnabled } from "@/lib/config";
import Portal from "./portal";
import { signInError } from "@/lib/auth/errors";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const user = await currentActor();
  if (!user)
    return (
      <Welcome
        initialError={signInError(params.error)}
        google={Boolean(
          process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
        )}
        demo={demoEnabled()}
      />
    );
  return <Portal />;
}
