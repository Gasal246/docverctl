import { Octokit } from "@octokit/rest";

import { decodeBase64, encodeBase64 } from "@/lib/utils";

export interface RepoRef {
  owner: string;
  repo: string;
  branch: string;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  sha?: string;
  size?: number;
}

export interface ReadFileResult {
  path: string;
  name: string;
  content: string;
  sha: string;
  encoding: string;
  downloadUrl: string | null;
  size: number;
}

export interface ReadFileRawResult {
  path: string;
  name: string;
  contentBase64: string;
  sha: string;
  size: number;
}

export function createGitHubClient(accessToken: string) {
  return new Octokit({ auth: accessToken });
}

export async function checkRepoAccessible(
  client: Octokit,
  owner: string,
  repo: string
) {
  const { data } = await client.repos.get({ owner, repo });
  return {
    private: data.private,
    defaultBranch: data.default_branch,
    htmlUrl: data.html_url,
    fullName: data.full_name
  };
}

export async function listDirectory(
  client: Octokit,
  repoRef: RepoRef,
  path = ""
): Promise<DirectoryEntry[]> {
  let data: Awaited<ReturnType<typeof client.repos.getContent>>["data"];
  try {
    const response = await client.repos.getContent({
      owner: repoRef.owner,
      repo: repoRef.repo,
      path,
      ref: repoRef.branch
    });
    data = response.data;
  } catch (error: unknown) {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? (error as { status?: number }).status
        : undefined;

    // GitHub returns 404 for root listing on empty repos with no commits.
    if (status === 404 && path === "") {
      return [];
    }

    throw error;
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((entry) => entry.type === "file" || entry.type === "dir")
    .map((entry) => ({
      name: entry.name,
      path: entry.path,
      type: entry.type as "file" | "dir",
      sha: "sha" in entry ? entry.sha : undefined,
      size: "size" in entry ? entry.size : undefined
    }))
    .sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "dir" ? -1 : 1;
    });
}

export async function readRepositoryFile(
  client: Octokit,
  repoRef: RepoRef,
  path: string
): Promise<ReadFileResult> {
  const { data } = await client.repos.getContent({
    owner: repoRef.owner,
    repo: repoRef.repo,
    path,
    ref: repoRef.branch
  });

  if (Array.isArray(data) || data.type !== "file") {
    throw new Error("Path is not a file");
  }

  return {
    path: data.path,
    name: data.name,
    content: data.content ? decodeBase64(data.content) : "",
    sha: data.sha,
    encoding: data.encoding,
    downloadUrl: data.download_url,
    size: data.size
  };
}

export async function readRepositoryFileRaw(
  client: Octokit,
  repoRef: RepoRef,
  path: string
): Promise<ReadFileRawResult> {
  const { data } = await client.repos.getContent({
    owner: repoRef.owner,
    repo: repoRef.repo,
    path,
    ref: repoRef.branch
  });

  if (Array.isArray(data) || data.type !== "file") {
    throw new Error("Path is not a file");
  }

  return {
    path: data.path,
    name: data.name,
    contentBase64: (data.content ?? "").replace(/\n/g, ""),
    sha: data.sha,
    size: data.size
  };
}

interface UpsertInput {
  path: string;
  content: string;
  message: string;
  sha?: string;
  contentIsBase64?: boolean;
}

export async function upsertFile(
  client: Octokit,
  repoRef: RepoRef,
  input: UpsertInput
) {
  return client.repos.createOrUpdateFileContents({
    owner: repoRef.owner,
    repo: repoRef.repo,
    path: input.path,
    message: input.message,
    content: input.contentIsBase64 ? input.content : encodeBase64(input.content),
    sha: input.sha,
    branch: repoRef.branch
  });
}

export async function deleteFile(
  client: Octokit,
  repoRef: RepoRef,
  input: { path: string; sha: string; message: string }
) {
  return client.repos.deleteFile({
    owner: repoRef.owner,
    repo: repoRef.repo,
    path: input.path,
    sha: input.sha,
    message: input.message,
    branch: repoRef.branch
  });
}

export async function moveFile(
  client: Octokit,
  repoRef: RepoRef,
  input: {
    fromPath: string;
    toPath: string;
    actorLogin: string;
    fromSha?: string;
  }
) {
  const file = await readRepositoryFile(client, repoRef, input.fromPath);

  await upsertFile(client, repoRef, {
    path: input.toPath,
    content: file.content,
    message: `Move ${input.fromPath} -> ${input.toPath} by @${input.actorLogin}`,
    sha: undefined
  });

  await deleteFile(client, repoRef, {
    path: input.fromPath,
    sha: input.fromSha ?? file.sha,
    message: `Delete original after move ${input.fromPath} by @${input.actorLogin}`
  });
}
