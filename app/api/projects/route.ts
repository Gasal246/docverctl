import { NextRequest, NextResponse } from "next/server";

import { requireAdmin, requireApiSession } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { connectToDatabase } from "@/lib/db";
import { env } from "@/lib/env";
import {
  createGitHubClient,
  checkRepoAccessible,
  upsertFile
} from "@/lib/github";
import { ApiError, handleApiError } from "@/lib/http";
import { ProjectModel } from "@/lib/models";
import { createProjectSchema } from "@/lib/schemas";
import { slugify } from "@/lib/utils";

async function seedProjectRepository({
  githubToken,
  owner,
  repo,
  branch,
  projectName,
  actorLogin
}: {
  githubToken: string;
  owner: string;
  repo: string;
  branch: string;
  projectName: string;
  actorLogin: string;
}) {
  const client = createGitHubClient(githubToken);
  const readmeContent = `# ${projectName}\n\nManaged by DocVerCtl.\n`;
  const repoRef = { owner, repo, branch };

  async function getFileSha(path: string) {
    try {
      const { data } = await client.repos.getContent({
        owner,
        repo,
        path,
        ref: branch
      });

      if (Array.isArray(data) || data.type !== "file") {
        return undefined;
      }

      return data.sha;
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        (error as { status?: number }).status === 404
      ) {
        return undefined;
      }
      throw error;
    }
  }

  const readmeSha = await getFileSha("README.md");
  const keepSha = await getFileSha("docs/.keep");

  await upsertFile(client, repoRef, {
    path: "README.md",
    content: readmeContent,
    message: `Seed README for ${projectName} by @${actorLogin}`,
    sha: readmeSha
  });

  await upsertFile(client, repoRef, {
    path: "docs/.keep",
    content: "",
    message: `Seed docs folder for ${projectName} by @${actorLogin}`,
    sha: keepSha
  });
}

export async function GET(req: NextRequest) {
  try {
    await requireApiSession(req);
    await connectToDatabase();

    const projects = await ProjectModel.find({ isArchived: false })
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({
      projects,
      canCreateRepo: env.ENABLE_GITHUB_REPO_CREATE
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, githubToken, allowedUser } = await requireApiSession(req);
    requireAdmin(allowedUser.isAdmin);

    const payload = createProjectSchema.parse(await req.json());
    const client = createGitHubClient(githubToken);
    const actorLogin = session.user.login;

    let repoOwner = payload.owner;
    let repoName = payload.repoName;
    let repoUrl = "";
    let defaultBranch = env.GITHUB_DEFAULT_BRANCH;

    if (payload.mode === "create") {
      if (!env.ENABLE_GITHUB_REPO_CREATE) {
        throw new ApiError(400, "Repo creation is disabled");
      }

      const targetOwner = env.GITHUB_REPO_CREATE_OWNER || payload.owner;

      if (targetOwner.toLowerCase() === actorLogin.toLowerCase()) {
        const { data } = await client.repos.createForAuthenticatedUser({
          name: payload.repoName,
          private: true,
          auto_init: true,
          description: `Project repo for ${payload.name}`
        });

        repoOwner = data.owner?.login ?? targetOwner;
        repoName = data.name;
        repoUrl = data.html_url;
        defaultBranch = data.default_branch;
      } else {
        const { data } = await client.repos.createInOrg({
          org: targetOwner,
          name: payload.repoName,
          private: true,
          auto_init: true,
          description: `Project repo for ${payload.name}`
        });

        repoOwner = data.owner?.login ?? targetOwner;
        repoName = data.name;
        repoUrl = data.html_url;
        defaultBranch = data.default_branch;
      }
    } else {
      const repoCheck = await checkRepoAccessible(client, repoOwner, repoName);

      if (!repoCheck.private) {
        throw new ApiError(400, "Repository must be private");
      }

      repoUrl = repoCheck.htmlUrl;
      defaultBranch = repoCheck.defaultBranch;
    }

    await connectToDatabase();
    const slug = slugify(payload.name) || slugify(`${repoOwner}-${repoName}`);

    const createdProject = await ProjectModel.create({
      name: payload.name,
      slug,
      repoOwner,
      repoName,
      repoUrl,
      defaultBranch,
      notificationEmails: payload.notificationEmails,
      createdByGithubId: Number(session.user.id),
      isArchived: false
    });

    await seedProjectRepository({
      githubToken,
      owner: repoOwner,
      repo: repoName,
      branch: defaultBranch,
      projectName: payload.name,
      actorLogin
    });

    await logAudit({
      actorGithubId: Number(session.user.id),
      actorLogin,
      action: "PROJECT_CREATE",
      projectId: createdProject._id.toString(),
      meta: {
        repoOwner,
        repoName,
        mode: payload.mode
      }
    });

    return NextResponse.json({ project: createdProject }, { status: 201 });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      return handleApiError(
        new ApiError(
          409,
          "Project already exists with this slug or repository. Change name/repo and retry."
        )
      );
    }

    return handleApiError(error);
  }
}
