import { describe, expect, it, vi } from "vitest";

const OctokitMock = vi.fn().mockImplementation((opts) => ({ opts }));

vi.mock("@octokit/rest", () => ({
  Octokit: OctokitMock
}));

describe("createGitHubClient", () => {
  it("constructs Octokit with access token", async () => {
    const { createGitHubClient } = await import("@/lib/github");

    const client = createGitHubClient("token-123");

    expect(OctokitMock).toHaveBeenCalledWith({ auth: "token-123" });
    expect(client).toEqual({ opts: { auth: "token-123" } });
  });
});
