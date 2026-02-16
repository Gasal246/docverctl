import { NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/api-auth";
import { createGitHubClient, listDirectory } from "@/lib/github";
import { handleApiError } from "@/lib/http";
import { getProjectOrThrow } from "@/lib/project-access";
import { ensureProjectRepositoryExists } from "@/lib/repo-guard";
import { treeQuerySchema } from "@/lib/schemas";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { githubToken } = await requireApiSession(req);
    const { id } = await params;
    const project = await getProjectOrThrow(id);

    const parsed = treeQuerySchema.parse({
      path: req.nextUrl.searchParams.get("path") ?? ""
    });

    const client = createGitHubClient(githubToken);
    await ensureProjectRepositoryExists(client, project);
    const entries = await listDirectory(
      client,
      {
        owner: project.repoOwner,
        repo: project.repoName,
        branch: project.defaultBranch
      },
      parsed.path
    );

    return NextResponse.json({ entries, basePath: parsed.path });
  } catch (error) {
    return handleApiError(error);
  }
}
