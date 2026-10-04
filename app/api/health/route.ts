import { database } from "@/lib/db/postgres";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await database().prepare("SELECT 1 ready").first();
    return Response.json(
      { status: "ok", service: "placement-desk" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
