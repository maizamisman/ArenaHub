import { getDb } from "@/data/db";
import { resetForTests } from "@/data/testReset";

export const dynamic = "force-dynamic";

/** Test-only: re-seeds the database. Returns 404 unless the server was started for e2e tests. */
export async function POST() {
  if (process.env.ARENAHUB_E2E !== "1") return new Response("Not found", { status: 404 });
  resetForTests(getDb(), process.env.ARENAHUB_TOTP_SECRET ?? "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  return Response.json({ ok: true });
}
