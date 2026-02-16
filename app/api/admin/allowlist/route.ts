import { NextRequest, NextResponse } from "next/server";

import { requireAdmin, requireApiSession } from "@/lib/api-auth";
import { connectToDatabase } from "@/lib/db";
import { ApiError, handleApiError } from "@/lib/http";
import { AllowedUserModel } from "@/lib/models";
import { addAllowUserSchema } from "@/lib/schemas";

export async function GET(req: NextRequest) {
  try {
    const { allowedUser } = await requireApiSession(req);
    requireAdmin(allowedUser.isAdmin);

    await connectToDatabase();
    const users = await AllowedUserModel.find({}).sort({ githubLogin: 1 }).lean();

    return NextResponse.json({ users });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, allowedUser } = await requireApiSession(req);
    requireAdmin(allowedUser.isAdmin);

    const payload = addAllowUserSchema.parse(await req.json());

    await connectToDatabase();

    const created = await AllowedUserModel.create({
      githubUserId: payload.githubUserId,
      githubLogin: payload.githubLogin.toLowerCase(),
      isAdmin: payload.isAdmin,
      addedBy: session.user.login,
      addedAt: new Date()
    });

    return NextResponse.json({ user: created }, { status: 201 });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      return handleApiError(new ApiError(409, "User already exists in allowlist"));
    }

    return handleApiError(error);
  }
}
