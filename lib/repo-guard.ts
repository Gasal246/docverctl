import { Octokit } from "@octokit/rest";

import { ApiError } from "@/lib/http";

interface ProjectLike {
  _id: unknown;
  repoOwner: string;
  repoName: string;
}

export async function ensureProjectRepositoryExists(
  client: Octokit,
  project: ProjectLike
) {
  try {
    await client.repos.get({
      owner: project.repoOwner,
      repo: project.repoName
    });
  } catch (error: unknown) {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status?: number }).status)
        : undefined;

    if (status === 404) {
      throw new ApiError(
        404,
        "Repository not found on GitHub.",
        { code: "REPO_NOT_FOUND_ON_GITHUB", projectId: String(project._id) }
      );
    }

    throw error;
  }
}
