import { NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { inferContentType, isEditableText } from "@/lib/file-types";
import {
  createGitHubClient,
  deleteFile,
  readRepositoryFile,
  upsertFile
} from "@/lib/github";
import { ApiError, handleApiError } from "@/lib/http";
import { notifyProjectChange } from "@/lib/notifications";
import { getProjectOrThrow } from "@/lib/project-access";
import { ensureProjectRepositoryExists } from "@/lib/repo-guard";
import { deleteFileSchema, fileQuerySchema, upsertFileSchema } from "@/lib/schemas";

function encodePath(path: string) {
  return path
    .split("/")
    .map((chunk) => encodeURIComponent(chunk))
    .join("/");
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

    const raw = req.nextUrl.searchParams.get("raw") === "true";
    const client = createGitHubClient(githubToken);
    await ensureProjectRepositoryExists(client, project);

    if (raw) {
      const rawResponse = await fetch(
        `https://api.github.com/repos/${project.repoOwner}/${project.repoName}/contents/${encodePath(parsed.path)}?ref=${encodeURIComponent(project.defaultBranch)}`,
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github.raw",
            "X-GitHub-Api-Version": "2022-11-28"
          },
          cache: "no-store"
        }
      );

      if (!rawResponse.ok) {
        throw new ApiError(rawResponse.status, "Unable to stream file content");
      }

      const bytes = await rawResponse.arrayBuffer();

      return new NextResponse(bytes, {
        status: 200,
        headers: {
          "Content-Type": rawResponse.headers.get("content-type") ?? inferContentType(parsed.path),
          "Cache-Control": "private, no-store"
        }
      });
    }

    if (isEditableText(parsed.path)) {
      const file = await readRepositoryFile(
        client,
        {
          owner: project.repoOwner,
          repo: project.repoName,
          branch: project.defaultBranch
        },
        parsed.path
      );

      return NextResponse.json({
        kind: "text",
        path: file.path,
        name: file.name,
        sha: file.sha,
        size: file.size,
        content: file.content
      });
    }

    const { data } = await client.repos.getContent({
      owner: project.repoOwner,
      repo: project.repoName,
      path: parsed.path,
      ref: project.defaultBranch
    });

    if (Array.isArray(data) || data.type !== "file") {
      throw new ApiError(400, "Path is not a file");
    }

    return NextResponse.json({
      kind: "binary",
      path: data.path,
      name: data.name,
      sha: data.sha,
      size: data.size,
      downloadUrl: data.download_url
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, githubToken } = await requireApiSession(req);
    const { id } = await params;
    const project = await getProjectOrThrow(id);

    const payload = upsertFileSchema.parse(await req.json());

    const client = createGitHubClient(githubToken);
    await ensureProjectRepositoryExists(client, project);
    const response = await upsertFile(
      client,
      {
        owner: project.repoOwner,
        repo: project.repoName,
        branch: project.defaultBranch
      },
      payload
    );

    const action = payload.sha ? "FILE_EDIT" : "FILE_CREATE";
    await logAudit({
      actorGithubId: Number(session.user.id),
      actorLogin: session.user.login,
      action,
      projectId: id,
      path: payload.path,
      meta: {
        message: payload.message,
        commitSha: response.data.commit.sha
      }
    });

    await logAudit({
      actorGithubId: Number(session.user.id),
      actorLogin: session.user.login,
      action: "COMMIT",
      projectId: id,
      path: payload.path,
      meta: {
        message: payload.message,
        commitSha: response.data.commit.sha
      }
    });

    try {
      await notifyProjectChange({
        recipients: project.notificationEmails ?? [],
        project: {
          name: project.name,
          repoOwner: project.repoOwner,
          repoName: project.repoName
        },
        actor: {
          githubId: Number(session.user.id),
          login: session.user.login
        },
        action,
        commitMessage: payload.message,
        commitSha: response.data.commit.sha,
        path: payload.path,
        occurredAt: new Date()
      });
    } catch (notificationError) {
      console.error("Failed to send project change notification", notificationError);
    }

    return NextResponse.json({
      ok: true,
      commitSha: response.data.commit.sha,
      contentSha: "content" in response.data ? response.data.content?.sha : undefined
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, githubToken } = await requireApiSession(req);
    const { id } = await params;
    const project = await getProjectOrThrow(id);

    const query = fileQuerySchema.parse({
      path: req.nextUrl.searchParams.get("path")
    });

    const body = await req.json();
    const payload = deleteFileSchema.parse({
      ...body,
      path: query.path
    });

    const client = createGitHubClient(githubToken);
    await ensureProjectRepositoryExists(client, project);

    const deleteResponse = await deleteFile(
      client,
      {
        owner: project.repoOwner,
        repo: project.repoName,
        branch: project.defaultBranch
      },
      {
        path: payload.path,
        sha: payload.sha,
        message: payload.message
      }
    );

    await logAudit({
      actorGithubId: Number(session.user.id),
      actorLogin: session.user.login,
      action: "FILE_DELETE",
      projectId: id,
      path: payload.path,
      meta: { message: payload.message }
    });

    try {
      await notifyProjectChange({
        recipients: project.notificationEmails ?? [],
        project: {
          name: project.name,
          repoOwner: project.repoOwner,
          repoName: project.repoName
        },
        actor: {
          githubId: Number(session.user.id),
          login: session.user.login
        },
        action: "FILE_DELETE",
        commitMessage: payload.message,
        commitSha: deleteResponse.data.commit.sha,
        path: payload.path,
        occurredAt: new Date()
      });
    } catch (notificationError) {
      console.error("Failed to send project change notification", notificationError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
