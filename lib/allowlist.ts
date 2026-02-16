import { connectToDatabase } from "@/lib/db";
import { parseAllowlistCsv } from "@/lib/env";
import { AllowedUserModel } from "@/lib/models";
import type { AllowedUser } from "@/lib/models/allowed-user";

export interface AllowlistIdentity {
  githubUserId?: number;
  githubLogin?: string;
}

function normalizeLogin(login?: string | null) {
  return login?.trim().toLowerCase();
}

export async function findAllowedUser(identity: AllowlistIdentity) {
  const login = normalizeLogin(identity.githubLogin);
  const githubUserId = identity.githubUserId;

  if (!login && !githubUserId) {
    return null;
  }

  await connectToDatabase();
  const user = await AllowedUserModel.findOne({
    $or: [
      ...(githubUserId ? [{ githubUserId }] : []),
      ...(login ? [{ githubLogin: login }] : [])
    ]
  })
    .lean()
    .exec();

  return user as (AllowedUser & { _id: unknown }) | null;
}

export async function isAllowlisted(identity: AllowlistIdentity) {
  const login = normalizeLogin(identity.githubLogin);

  if (!login && !identity.githubUserId) {
    return false;
  }

  const fallbackAllowlist = parseAllowlistCsv();
  if (login && fallbackAllowlist.includes(login)) {
    return true;
  }

  const user = await findAllowedUser({
    githubUserId: identity.githubUserId,
    githubLogin: login
  });

  return Boolean(user);
}

export async function isAdmin(identity: AllowlistIdentity) {
  const user = await findAllowedUser(identity);
  return Boolean(user?.isAdmin);
}
