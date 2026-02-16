import { describe, expect, it } from "vitest";

import { createProjectSchema } from "@/lib/schemas";

describe("createProjectSchema", () => {
  it("rejects invalid repo names", () => {
    expect(() =>
      createProjectSchema.parse({
        mode: "connect",
        name: "Project X",
        owner: "acme",
        repoName: "bad repo name"
      })
    ).toThrow();
  });

  it("accepts valid payload", () => {
    const payload = createProjectSchema.parse({
      mode: "connect",
      name: "Project X",
      owner: "acme",
      repoName: "project-x-docs"
    });

    expect(payload.repoName).toBe("project-x-docs");
  });
});
