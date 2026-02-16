import { Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { ProjectModel } from "@/lib/models";
import type { Project } from "@/lib/models/project";

export async function getProjectOrThrow(projectId: string): Promise<Project> {
  if (!Types.ObjectId.isValid(projectId)) {
    throw new ApiError(400, "Invalid project id");
  }

  await connectToDatabase();
  const project = (await ProjectModel.findById(projectId).lean().exec()) as
    | Project
    | null;

  if (!project || project.isArchived) {
    throw new ApiError(404, "Project not found");
  }

  return project as Project;
}
