import { NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/api-auth";
import { handleApiError } from "@/lib/http";

export async function GET(req: NextRequest) {
  try {
    const { session, allowedUser } = await requireApiSession(req);

    return NextResponse.json({
      user: {
        ...session.user,
        isAdmin: allowedUser.isAdmin
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
