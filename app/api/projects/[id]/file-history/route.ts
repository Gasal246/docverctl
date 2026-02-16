import { NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/api-auth";
import { createGitHubClient } from "@/lib/github";
import { ApiError, handleApiError } from "@/lib/http";
import { getProjectOrThrow } from "@/lib/project-access";
import { ensureProjectRepositoryExists } from "@/lib/repo-guard";
import { fileQuerySchema } from "@/lib/schemas";
import { decodeBase64 } from "@/lib/utils";

function normalizeContent(base64Content?: string) {
  return base64Content ? decodeBase64(base64Content.replace(/\n/g, "")) : "";
}

async function getFileContentAtRef(input: {
  client: ReturnType<typeof createGitHubClient>;
  owner: string;
  repo: string;
  path: string;
  ref: string;
}) {
  try {
    const response = await input.client.repos.getContent({
      owner: input.owner,
      repo: input.repo,
      path: input.path,
      ref: input.ref
    });

    if (Array.isArray(response.data) || response.data.type !== "file") {
      throw new ApiError(400, `Content at ref ${input.ref} is not a file`);
    }

    return normalizeContent(response.data.content);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      (error as { status?: number }).status === 404
    ) {
      return "";
    }

    throw error;
  }
}

async function getCommitMeta(input: {
  client: ReturnType<typeof createGitHubClient>;
  owner: string;
  repo: string;
  ref: string;
}) {
  const response = await input.client.repos.getCommit({
    owner: input.owner,
    repo: input.repo,
    ref: input.ref
  });

  return {
    sha: response.data.sha,
    date: response.data.commit.author?.date,
    message: response.data.commit.message
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { githubToken } = await requireApiSession(req);
    const { id } = await params;
    const project = await getProjectOrThrow(id);

    const parsed = fileQuerySchema.parse({
      path: req.nextUrl.searchParams.get("path")
    });
    const baseShaParam = req.nextUrl.searchParams.get("baseSha") ?? undefined;
    const headShaParam = req.nextUrl.searchParams.get("headSha") ?? undefined;

    const client = createGitHubClient(githubToken);
    await ensureProjectRepositoryExists(client, project);

    const commitsResponse = await client.repos.listCommits({
      owner: project.repoOwner,
      repo: project.repoName,
      path: parsed.path,
      sha: project.defaultBranch,
      per_page: 50
    });

    const commits = commitsResponse.data;

    if (!commits.length) {
      throw new ApiError(404, "No commits found for this file");
    }

    const latestCommit = commits[0];
    const previousCommit = commits[1];
    const commitList = commits.map((commit) => ({
      sha: commit.sha,
      date: commit.commit.author?.date,
      message: commit.commit.message
    }));

    const latestContent = await getFileContentAtRef({
      client,
      owner: project.repoOwner,
      repo: project.repoName,
      path: parsed.path,
      ref: latestCommit.sha
    });

    const previousContent = previousCommit
      ? await getFileContentAtRef({
          client,
          owner: project.repoOwner,
          repo: project.repoName,
          path: parsed.path,
          ref: previousCommit.sha
        })
      : "";

    let comparison: {
      base: { sha: string; date?: string; message?: string; content: string };
      head: { sha: string; date?: string; message?: string; content: string };
    } | null = null;

    if (baseShaParam && headShaParam) {
      const [baseMeta, headMeta, baseContent, headContent] = await Promise.all([
        getCommitMeta({
          client,
          owner: project.repoOwner,
          repo: project.repoName,
          ref: baseShaParam
        }),
        getCommitMeta({
          client,
          owner: project.repoOwner,
          repo: project.repoName,
          ref: headShaParam
        }),
        getFileContentAtRef({
          client,
          owner: project.repoOwner,
          repo: project.repoName,
          path: parsed.path,
          ref: baseShaParam
        }),
        getFileContentAtRef({
          client,
          owner: project.repoOwner,
          repo: project.repoName,
          path: parsed.path,
          ref: headShaParam
        })
      ]);

      comparison = {
        base: {
          ...baseMeta,
          content: baseContent
        },
        head: {
          ...headMeta,
          content: headContent
        }
      };
    }

    return NextResponse.json({
      path: parsed.path,
      commits: commitList,
      latest: {
        sha: latestCommit.sha,
        date: latestCommit.commit.author?.date,
        message: latestCommit.commit.message,
        content: latestContent
      },
      previous: previousCommit
        ? {
            sha: previousCommit.sha,
            date: previousCommit.commit.author?.date,
            message: previousCommit.commit.message,
            content: previousContent
          }
        : null,
      comparison
    });
  } catch (error) {
    return handleApiError(error);
  }
}
