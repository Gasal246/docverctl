import { Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import { AuditLogModel, FileLockModel, ProjectModel } from "@/lib/models";

export async function purgeProjectData(projectId: string) {
  if (!Types.ObjectId.isValid(projectId)) {
    return;
  }

  await connectToDatabase();
  const _id = new Types.ObjectId(projectId);

  await Promise.all([
    ProjectModel.deleteOne({ _id }),
    AuditLogModel.deleteMany({ projectId: _id }),
    FileLockModel.deleteMany({ projectId: _id })
  ]);
}
