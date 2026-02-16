import { Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import { AuditAction, AuditLogModel } from "@/lib/models";

interface LogAuditInput {
  actorGithubId: number;
  actorLogin: string;
  action: AuditAction;
  projectId: string;
  path?: string;
  meta?: Record<string, unknown>;
}

export async function logAudit(input: LogAuditInput) {
  await connectToDatabase();

  await AuditLogModel.create({
    actorGithubId: input.actorGithubId,
    actorLogin: input.actorLogin,
    action: input.action,
    projectId: new Types.ObjectId(input.projectId),
    path: input.path,
    meta: input.meta,
    createdAt: new Date()
  });
}
