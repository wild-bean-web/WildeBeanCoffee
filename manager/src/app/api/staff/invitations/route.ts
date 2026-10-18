import { parseStaffInvite } from "@/domain/companies";
import { requireCapability } from "@/lib/auth/session";
import { dataResponse, errorResponse, routeErrorResponse } from "@/lib/http";
import { inviteStaffMember } from "@/services/staff/invite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireCapability("users:manage");
    if (!session.organizationId) {
      return errorResponse(403, "NO_ORGANIZATION", "This account is not tied to a company.");
    }
    const parsed = parseStaffInvite(await request.json().catch(() => null));
    if (!parsed.ok) return errorResponse(422, "INVITE_INVALID", parsed.message);
    const result = await inviteStaffMember({
      organizationId: session.organizationId,
      invitedByStaffMemberId: session.staffMemberId,
      invite: parsed.value,
    });
    if (!result.ok) return errorResponse(422, "INVITE_NOT_SENT", result.message);
    return dataResponse({ message: result.message });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
