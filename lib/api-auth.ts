import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";

import { findAllowedUser, isAllowlisted } from "@/lib/allowlist";
import { getAuthSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/http";

export async function requireApiSession(req: NextRequest) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    throw new ApiError(401, "Unauthorized");
  }

  const githubUserId = Number(session.user.id);
  const githubLogin = session.user.login?.toLowerCase();

  const allowedUserRecord = await findAllowedUser({ githubUserId, githubLogin });
  const allowed =
    Boolean(allowedUserRecord) ||
    (await isAllowlisted({ githubUserId, githubLogin }));

  if (!allowed) {
    throw new ApiError(403, "You are not authorized / not allowed to pass through");
  }

  const jwt = await getToken({ req, secret: env.NEXTAUTH_SECRET });
  if (!jwt?.accessToken) {
    throw new ApiError(401, "Missing GitHub access token");
  }

  return {
    session,
    githubToken: String(jwt.accessToken),
    allowedUser: allowedUserRecord ?? { isAdmin: false }
  };
}

export function requireAdmin(isAdminFlag?: boolean) {
  if (!isAdminFlag) {
    throw new ApiError(403, "Admin permissions required");
  }
}
