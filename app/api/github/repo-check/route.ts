import { NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/api-auth";
import { checkRepoAccessible, createGitHubClient } from "@/lib/github";
import { ApiError, handleApiError } from "@/lib/http";
import { repoCheckSchema } from "@/lib/schemas";

export async function GET(req: NextRequest) {
  try {
    const { githubToken } = await requireApiSession(req);

    const payload = repoCheckSchema.parse({
      owner: req.nextUrl.searchParams.get("owner"),
      repoName: req.nextUrl.searchParams.get("repoName")
    });

    const client = createGitHubClient(githubToken);
    const repo = await checkRepoAccessible(client, payload.owner, payload.repoName);

    if (!repo.private) {
      throw new ApiError(400, "Repository is not private");
    }

    return NextResponse.json({ ok: true, repo });
  } catch (error) {
    return handleApiError(error);
  }
}
