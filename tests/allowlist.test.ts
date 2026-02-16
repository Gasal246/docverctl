import { beforeEach, describe, expect, it, vi } from "vitest";

const findOneMock = vi.fn();
const execMock = vi.fn();
const parseAllowlistCsvMock = vi.fn(() => []);

vi.mock("@/lib/db", () => ({
  connectToDatabase: vi.fn()
}));

vi.mock("@/lib/env", () => ({
  parseAllowlistCsv: parseAllowlistCsvMock
}));

vi.mock("@/lib/models", () => ({
  AllowedUserModel: {
    findOne: findOneMock
  }
}));

describe("allowlist gate", () => {
  beforeEach(() => {
    parseAllowlistCsvMock.mockReturnValue([]);
    findOneMock.mockReturnValue({ lean: () => ({ exec: execMock }) });
    execMock.mockResolvedValue(null);
  });

  it("authorizes via CSV fallback", async () => {
    parseAllowlistCsvMock.mockReturnValue(["octocat"]);

    const { isAllowlisted } = await import("@/lib/allowlist");
    const allowed = await isAllowlisted({ githubLogin: "octocat" });

    expect(allowed).toBe(true);
    expect(findOneMock).not.toHaveBeenCalled();
  });

  it("authorizes via DB allowlist", async () => {
    execMock.mockResolvedValue({ githubLogin: "octocat", githubUserId: 1 });

    const { isAllowlisted } = await import("@/lib/allowlist");
    const allowed = await isAllowlisted({ githubLogin: "octocat", githubUserId: 1 });

    expect(allowed).toBe(true);
    expect(findOneMock).toHaveBeenCalled();
  });

  it("blocks non-allowlisted user", async () => {
    const { isAllowlisted } = await import("@/lib/allowlist");
    const allowed = await isAllowlisted({ githubLogin: "outsider", githubUserId: 42 });

    expect(allowed).toBe(false);
  });
});
