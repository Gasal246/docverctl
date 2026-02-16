import { NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import {
  createGitHubClient,
  deleteFile,
  readRepositoryFileRaw,
  upsertFile
} from "@/lib/github";
import { ApiError, handleApiError } from "@/lib/http";
import { notifyProjectChange } from "@/lib/notifications";
import { getProjectOrThrow } from "@/lib/project-access";
import { ensureProjectRepositoryExists } from "@/lib/repo-guard";
import { renameSchema } from "@/lib/schemas";

async function movePath(
  client: ReturnType<typeof createGitHubClient>,
  project: Awaited<ReturnType<typeof getProjectOrThrow>>,
  fromPath: string,
  toPath: string,
  actorLogin: string
) {
  const { data } = await client.repos.getContent({
    owner: project.repoOwner,
    repo: project.repoName,
    path: fromPath,
    ref: project.defaultBranch
  });

  if (Array.isArray(data)) {
    for (const item of data) {
      const nextToPath = item.path.replace(fromPath, toPath);

      if (item.type === "dir") {
        await movePath(client, project, item.path, nextToPath, actorLogin);
      }

      if (item.type === "file") {
        const file = await readRepositoryFileRaw(
          client,
          {
            owner: project.repoOwner,
            repo: project.repoName,
            branch: project.defaultBranch
          },
          item.path
        );

        await upsertFile(
          client,
          {
            owner: project.repoOwner,
            repo: project.repoName,
            branch: project.defaultBranch
          },
          {
            path: nextToPath,
            content: file.contentBase64,
            contentIsBase64: true,
            message: `Move ${item.path} -> ${nextToPath} by @${actorLogin}`
          }
        );

        await deleteFile(
          client,
          {
            owner: project.repoOwner,
            repo: project.repoName,
            branch: project.defaultBranch
          },
          {
            path: item.path,
            sha: file.sha,
            message: `Delete old path ${item.path} by @${actorLogin}`
          }
        );
      }
    }

    return;
  }

  if (data.type !== "file") {
    throw new ApiError(400, "Unsupported path type for rename");
  }

  const file = await readRepositoryFileRaw(
    client,
    {
      owner: project.repoOwner,
      repo: project.repoName,
      branch: project.defaultBranch
    },
    fromPath
  );

  await upsertFile(
    client,
    {
      owner: project.repoOwner,
      repo: project.repoName,
      branch: project.defaultBranch
    },
    {
      path: toPath,
      content: file.contentBase64,
      contentIsBase64: true,
      message: `Rename ${fromPath} -> ${toPath} by @${actorLogin}`
    }
  );

  await deleteFile(
    client,
    {
      owner: project.repoOwner,
      repo: project.repoName,
      branch: project.defaultBranch
    },
    {
      path: fromPath,
      sha: file.sha,
      message: `Delete old path ${fromPath} by @${actorLogin}`
    }
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, githubToken } = await requireApiSession(req);
    const { id } = await params;
    const project = await getProjectOrThrow(id);

    const payload = renameSchema.parse(await req.json());

    if (payload.fromPath === payload.toPath) {
      throw new ApiError(400, "fromPath and toPath cannot be the same");
    }

    const client = createGitHubClient(githubToken);
    await ensureProjectRepositoryExists(client, project);

    await movePath(client, project, payload.fromPath, payload.toPath, session.user.login);

    await logAudit({
      actorGithubId: Number(session.user.id),
      actorLogin: session.user.login,
      action: "RENAME",
      projectId: id,
      path: payload.fromPath,
      meta: { toPath: payload.toPath }
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
        action: "RENAME",
        commitMessage: `Rename/move ${payload.fromPath} -> ${payload.toPath}`,
        path: payload.fromPath,
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
