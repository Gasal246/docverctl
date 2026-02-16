"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Folder, Plus, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Project = {
  _id: string;
  name: string;
  slug: string;
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  defaultBranch: string;
  updatedAt: string;
};

type Viewer = {
  id: string;
  login: string;
  isAdmin: boolean;
};

export function ProjectsPageClient() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [canCreateRepo, setCanCreateRepo] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [notificationEmailsRaw, setNotificationEmailsRaw] = useState("");
  const [mode, setMode] = useState<"connect" | "create">("connect");

  async function load() {
    setLoading(true);

    try {
      const [projectsRes, meRes] = await Promise.all([
        fetch("/api/projects", { cache: "no-store" }),
        fetch("/api/user/me", { cache: "no-store" })
      ]);

      if (!projectsRes.ok || !meRes.ok) {
        throw new Error("Failed to load projects");
      }

      const projectsJson = await projectsRes.json();
      const meJson = await meRes.json();

      setProjects(projectsJson.projects ?? []);
      setCanCreateRepo(Boolean(projectsJson.canCreateRepo));
      setViewer(meJson.user ?? null);
      setOwner(meJson.user?.login ?? "");
    } catch (error) {
      console.error(error);
      toast.error("Unable to load projects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [projects]
  );

  async function createProject() {
    if (!name.trim() || !owner.trim() || !repoName.trim()) {
      toast.error("All fields are required");
      return;
    }

    setCreating(true);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode,
          name,
          owner,
          repoName,
          notificationEmails: notificationEmailsRaw
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create project");
      }

      toast.success("Project saved");
      setName("");
      setRepoName("");
      setNotificationEmailsRaw("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Explore documentation repositories as files and folders.
          </p>
        </div>
        <Badge variant="secondary">{projects.length} projects</Badge>
      </header>

      {viewer?.isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Create Project</CardTitle>
            <CardDescription>
              Connect an existing private repository, or create one if enabled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <Input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Repo owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
              <Input
                placeholder="Repo name"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
              />
            </div>
            <Input
              placeholder="Collaborator emails for commit notifications (comma separated)"
              value={notificationEmailsRaw}
              onChange={(e) => setNotificationEmailsRaw(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={mode === "connect"}
                  onChange={() => setMode("connect")}
                />
                Connect existing private repo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={mode === "create"}
                  onChange={() => setMode("create")}
                  disabled={!canCreateRepo}
                />
                Create new private repo
              </label>
              {!canCreateRepo ? (
                <span className="text-xs text-muted-foreground">
                  Creation mode disabled by feature flag.
                </span>
              ) : null}
            </div>
            <Button onClick={() => void createProject()} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Save project
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading projects...
        </div>
      ) : sortedProjects.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No projects yet. {viewer?.isAdmin ? "Create one above." : "Ask admin to create one."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedProjects.map((project) => (
            <Card key={project._id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Folder className="h-4 w-4" />
                  {project.name}
                </CardTitle>
                <CardDescription>
                  <span className="inline-flex items-center gap-1">
                    <Lock className="h-3.5 w-3.5" />
                    {project.repoOwner}/{project.repoName}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Default branch: <strong>{project.defaultBranch}</strong>
                </p>
                <Button asChild className="w-full">
                  <Link href={`/projects/${project._id}`}>Open Explorer</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
