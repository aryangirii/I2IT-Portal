import Image from "next/image";
import { currentActor } from "@/lib/auth/session";
import { demoEnabled } from "@/lib/config";
import { SignIn } from "@/components/portal/signin";
import Portal from "./portal";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await currentActor();
  if (!user)
    return (
      <main className="signin">
        <Image
          unoptimized
          src="/college-logo.png"
          alt="I²IT Pune"
          width="68"
          height="90"
        />
        <p className="eyebrow">I²IT PUNE · PLACEMENT DESK</p>
        <h1>
          Your placement events,
          <br />
          in one place.
        </h1>
        <p>
          Sign in with your approved email to view events and attendance. TNP
          administrators manage access through the official student roster.
        </p>
        <SignIn
          google={Boolean(
            process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
          )}
          demo={demoEnabled()}
        />
        <p className="note">
          Use the same email that TNP has linked to your CRN.
        </p>
      </main>
    );
  return <Portal />;
}
