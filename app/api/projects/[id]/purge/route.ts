import { NextRequest, NextResponse } from "next/server";

import { requireAdmin, requireApiSession } from "@/lib/api-auth";
import { createGitHubClient } from "@/lib/github";
import { ApiError, handleApiError } from "@/lib/http";
import { purgeProjectData } from "@/lib/project-cleanup";
import { getProjectOrThrow } from "@/lib/project-access";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { githubToken, allowedUser } = await requireApiSession(req);
    requireAdmin(allowedUser.isAdmin);
    const { id } = await params;
    const project = await getProjectOrThrow(id);

    const client = createGitHubClient(githubToken);

    try {
      await client.repos.get({
        owner: project.repoOwner,
        repo: project.repoName
      });

      throw new ApiError(
        409,
        "Repository is still accessible on GitHub. Cleanup is blocked."
      );
    } catch (error: unknown) {
      const status =
        typeof error === "object" && error !== null && "status" in error
          ? Number((error as { status?: number }).status)
          : undefined;

      if (status !== 404) {
        if (error instanceof ApiError) {
          throw error;
        }
        throw error;
      }
    }

    await purgeProjectData(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
