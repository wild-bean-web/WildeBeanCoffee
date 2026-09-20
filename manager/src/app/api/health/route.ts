import { dataResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return dataResponse({
    status: "ok",
    service: "wild-bean-manager",
    timestamp: new Date().toISOString(),
  });
}
