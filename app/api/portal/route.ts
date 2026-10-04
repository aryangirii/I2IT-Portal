import { actor, database } from "@/lib/server";
import { portalRequest } from "@/lib/http/portal";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const GET = (req: Request) =>
  portalRequest(req, false, { getActor: actor, getDatabase: database });
export const POST = (req: Request) =>
  portalRequest(req, true, { getActor: actor, getDatabase: database });
