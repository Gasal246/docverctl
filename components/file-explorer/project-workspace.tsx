"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlignJustify,
  Check,
  ChevronDown,
  ChevronRight,
  Columns2,
  File,
  FileDiff,
  FileText,
  Folder,
  FolderOpen,
  GitCompareArrows,
  History,
  Loader2,
  Mail,
  PencilLine,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  X
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { isDocx, isPdf } from "@/lib/file-types";

const MonacoEditor = dynamic(
  async () => (await import("@monaco-editor/react")).Editor,
  { ssr: false }
);

const MonacoDiffEditor = dynamic(
  async () => (await import("@monaco-editor/react")).DiffEditor,
  { ssr: false }
);

type Project = {
  _id: string;
  name: string;
  repoOwner: string;
  repoName: string;
  notificationEmails?: string[];
};

type TreeEntry = {
  name: string;
  path: string;
  type: "file" | "dir";
  sha?: string;
  size?: number;
};

type FileState = {
  kind: "text" | "binary";
  path: string;
  name: string;
  sha?: string;
  size: number;
  content?: string;
};

type CommitMeta = {
  sha: string;
  date?: string;
  message?: string;
};

type FileHistoryState = {
  commits: CommitMeta[];
  latest: CommitMeta & { content: string };
  previous: (CommitMeta & { content: string }) | null;
};

type CommitComparisonState = {
  base: CommitMeta & { content: string };
  head: CommitMeta & { content: string };
};

type DiffMode =
  | "unsaved_vs_last_commit"
  | "last_commit_vs_previous_commit"
  | "compare_any_two_commits";
type MarkdownViewMode = "preview" | "edit";

interface ProjectWorkspaceProps {
  projectId: string;
}

function joinPath(base: string, name: string) {
  return base ? `${base}/${name}` : name;
}

function getParentPath(path: string) {
  const chunks = path.split("/").filter(Boolean);
  chunks.pop();
  return chunks.join("/");
}

function pathMatchesSearch(
  entry: TreeEntry,
  treeMap: Record<string, TreeEntry[]>,
  search: string
): boolean {
  if (!search) return true;

  if (entry.name.toLowerCase().includes(search.toLowerCase())) return true;
  if (entry.type === "file") return false;

  const children = treeMap[entry.path] ?? [];
  return children.some((child) => pathMatchesSearch(child, treeMap, search));
}

function formatCommitDate(raw?: string) {
  if (!raw) return "Unknown date";
  return new Date(raw).toLocaleString();
}

function shortSha(sha?: string) {
  if (!sha) return "unknown";
  return sha.slice(0, 7);
}

function formatCommitOptionLabel(commit: CommitMeta) {
  const headline = commit.message?.split("\n")[0] ?? "(no message)";
  return `${shortSha(commit.sha)} · ${formatCommitDate(commit.date)} · ${headline}`;
}

function parseFileInput(rawInput: string) {
  const normalized = rawInput.trim().replace(/^\/+/, "");
  if (!normalized) {
    return { error: "Provide a file name to continue." };
  }

  const segments = normalized.split("/").filter(Boolean);
  const fileName = segments.at(-1) ?? "";
  const isSupported = fileName.endsWith(".md") || fileName.endsWith(".txt");

  if (!isSupported) {
    return { error: "Only .md and .txt files are supported." };
  }

  if (segments.some((segment) => segment === "." || segment === "..")) {
    return { error: "Use a valid path without '.' or '..' segments." };
  }

  return {
    path: segments.join("/"),
    name: fileName
  };
}

function parseFolderName(rawInput: string) {
  const normalized = rawInput.trim().replace(/^\/+|\/+$/g, "");

  if (!normalized) {
    return { error: "Provide a folder name to continue." };
  }

  if (normalized.includes("..")) {
    return { error: "Use a valid folder name without '..'." };
  }

  return { folder: normalized };
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function IconToolbarButton({
  tooltip,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { tooltip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="icon" className="h-8 w-8" {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function ProjectWorkspace({ projectId }: ProjectWorkspaceProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [treeMap, setTreeMap] = useState<Record<string, TreeEntry[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set([""]));
  const [search, setSearch] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loadedFile, setLoadedFile] = useState<FileState | null>(null);
  const [originalContent, setOriginalContent] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [fileHistory, setFileHistory] = useState<FileHistoryState | null>(null);
  const [commitComparison, setCommitComparison] = useState<CommitComparisonState | null>(null);
  const [baseCommitSha, setBaseCommitSha] = useState("");
  const [headCommitSha, setHeadCommitSha] = useState("");
  const [loadingCommitComparison, setLoadingCommitComparison] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [diffView, setDiffView] = useState<"side" | "unified">("side");
  const [diffMode, setDiffMode] = useState<DiffMode>("unsaved_vs_last_commit");
  const [markdownViewMode, setMarkdownViewMode] = useState<MarkdownViewMode>("preview");
  const [pendingNewFilePath, setPendingNewFilePath] = useState<string | null>(null);
  const [repoNotFoundPrompted, setRepoNotFoundPrompted] = useState(false);
  const [viewerIsAdmin, setViewerIsAdmin] = useState<boolean>(false);
  const [notificationEmails, setNotificationEmails] = useState<string[]>([]);
  const [emailsDialogOpen, setEmailsDialogOpen] = useState(false);
  const [editingEmailIndex, setEditingEmailIndex] = useState<number | null>(null);
  const [editingEmailValue, setEditingEmailValue] = useState("");
  const [newEmailValue, setNewEmailValue] = useState("");
  const [savingNotificationEmails, setSavingNotificationEmails] = useState(false);

  const isDirty = loadedFile?.kind === "text" && editedContent !== originalContent;
  const isMarkdownFile = loadedFile?.kind === "text" && loadedFile.path.endsWith(".md");
  const hasUnsavedNewFile = Boolean(pendingNewFilePath);

  const breadcrumbs = useMemo(() => {
    if (!selectedPath) return [] as string[];
    return selectedPath.split("/").filter(Boolean);
  }, [selectedPath]);

  const loadProject = useCallback(async () => {
    const response = await fetch("/api/projects", { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load project list");
    }

    const current = (payload.projects ?? []).find((item: Project) => item._id === projectId);
    if (!current) {
      throw new Error("Project not found");
    }

    setProject(current);
    setNotificationEmails(current.notificationEmails ?? []);
  }, [projectId]);

  const loadViewer = useCallback(async () => {
    try {
      const response = await fetch("/api/user/me", { cache: "no-store" });
      const payload = await response.json();

      if (response.ok) {
        setViewerIsAdmin(Boolean(payload.user?.isAdmin));
      }
    } catch {
      setViewerIsAdmin(false);
    }
  }, []);

  const promptAndPurgeMissingRepository = useCallback(async () => {
    if (repoNotFoundPrompted) {
      return;
    }

    setRepoNotFoundPrompted(true);
    if (!viewerIsAdmin) {
      toast.error(
        "You're not able to access this repository. Ask an admin to grant access or verify repository status."
      );
      return;
    }

    const shouldDelete = window.confirm(
      "Repository not found or inaccessible on GitHub. Do you want to delete its belongings from this app?"
    );

    if (!shouldDelete) {
      toast.error("Cleanup cancelled.");
      return;
    }

    const response = await fetch(`/api/projects/${projectId}/purge`, {
      method: "DELETE"
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to delete project belongings");
    }

    toast.success("Project belongings deleted from this app.");
    window.location.href = "/projects";
  }, [projectId, repoNotFoundPrompted, viewerIsAdmin]);

  const loadDirectory = useCallback(
    async (path: string) => {
      const response = await fetch(
        `/api/projects/${projectId}/tree?path=${encodeURIComponent(path)}`,
        { cache: "no-store" }
      );
      const payload = await response.json();

      if (!response.ok) {
        if (payload?.details?.code === "REPO_NOT_FOUND_ON_GITHUB") {
          await promptAndPurgeMissingRepository();
          return;
        }
        throw new Error(payload.error ?? "Failed to load directory");
      }

      setTreeMap((prev) => ({
        ...prev,
        [path]: payload.entries ?? []
      }));
    },
    [projectId, promptAndPurgeMissingRepository]
  );

  const loadFileHistory = useCallback(
    async (path: string) => {
      setLoadingHistory(true);
      try {
        const response = await fetch(
          `/api/projects/${projectId}/file-history?path=${encodeURIComponent(path)}`,
          { cache: "no-store" }
        );
        const payload = await response.json();

        if (!response.ok) {
          if (payload?.details?.code === "REPO_NOT_FOUND_ON_GITHUB") {
            await promptAndPurgeMissingRepository();
            return;
          }
          throw new Error(payload.error ?? "Failed to load file history");
        }

        const commits = (payload.commits ?? []) as CommitMeta[];
        const latestSha = payload.latest?.sha as string | undefined;
        const previousSha = payload.previous?.sha as string | undefined;

        setFileHistory({
          commits,
          latest: payload.latest,
          previous: payload.previous
        });
        setCommitComparison(null);
        setHeadCommitSha(latestSha ?? "");
        setBaseCommitSha(previousSha ?? latestSha ?? "");
      } catch (error) {
        setFileHistory(null);
        setCommitComparison(null);
        setHeadCommitSha("");
        setBaseCommitSha("");
        toast.error(error instanceof Error ? error.message : "Failed to load file history");
      } finally {
        setLoadingHistory(false);
      }
    },
    [projectId, promptAndPurgeMissingRepository]
  );

  const loadFile = useCallback(
    async (path: string) => {
      setLoadingFile(true);
      setShowDiff(false);
      setDiffMode("unsaved_vs_last_commit");
      setCommitComparison(null);

      try {
        const response = await fetch(
          `/api/projects/${projectId}/file?path=${encodeURIComponent(path)}`,
          { cache: "no-store" }
        );
        const payload = await response.json();

        if (!response.ok) {
          if (payload?.details?.code === "REPO_NOT_FOUND_ON_GITHUB") {
            await promptAndPurgeMissingRepository();
            return;
          }
          throw new Error(payload.error ?? "Failed to load file");
        }

        if (payload.kind === "text") {
          setLoadedFile({
            kind: "text",
            path: payload.path,
            name: payload.name,
            sha: payload.sha,
            size: payload.size,
            content: payload.content
          });
          setOriginalContent(payload.content ?? "");
          setEditedContent(payload.content ?? "");
          setMarkdownViewMode(payload.path.endsWith(".md") ? "preview" : "edit");
          await loadFileHistory(payload.path);
        } else {
          setLoadedFile({
            kind: "binary",
            path: payload.path,
            name: payload.name,
            sha: payload.sha,
            size: payload.size
          });
          setOriginalContent("");
          setEditedContent("");
          setFileHistory(null);
          setCommitComparison(null);
          setBaseCommitSha("");
          setHeadCommitSha("");
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load file");
      } finally {
        setLoadingFile(false);
      }
    },
    [loadFileHistory, projectId, promptAndPurgeMissingRepository]
  );

  const loadCommitComparison = useCallback(
    async (path: string, baseSha: string, headSha: string) => {
      if (!baseSha || !headSha) return;

      setLoadingCommitComparison(true);
      try {
        const response = await fetch(
          `/api/projects/${projectId}/file-history?path=${encodeURIComponent(
            path
          )}&baseSha=${encodeURIComponent(baseSha)}&headSha=${encodeURIComponent(headSha)}`,
          { cache: "no-store" }
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to compare commits");
        }

        if (!payload.comparison?.base || !payload.comparison?.head) {
          throw new Error("Comparison payload is missing");
        }

        setCommitComparison({
          base: payload.comparison.base,
          head: payload.comparison.head
        });
      } catch (error) {
        setCommitComparison(null);
        toast.error(error instanceof Error ? error.message : "Failed to compare commits");
      } finally {
        setLoadingCommitComparison(false);
      }
    },
    [projectId]
  );

  async function refreshTree() {
    setLoadingTree(true);
    try {
      await loadDirectory("");
      const expandedPaths = [...expanded].filter(Boolean);
      for (const path of expandedPaths) {
        await loadDirectory(path);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh tree");
    } finally {
      setLoadingTree(false);
    }
  }

  async function persistNotificationEmails(
    nextEmails: string[],
    successMessage: string
  ) {
    setSavingNotificationEmails(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/notification-emails`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          notificationEmails: nextEmails
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update emails");
      }

      const updatedEmails = (payload.notificationEmails ?? []) as string[];
      setNotificationEmails(updatedEmails);
      setProject((prev) =>
        prev
          ? {
              ...prev,
              notificationEmails: updatedEmails
            }
          : prev
      );
      toast.success(successMessage);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update emails");
      return false;
    } finally {
      setSavingNotificationEmails(false);
    }
  }

  function openEmailsDialog() {
    setEditingEmailIndex(null);
    setEditingEmailValue("");
    setNewEmailValue("");
    setEmailsDialogOpen(true);
  }

  function closeEmailsDialog() {
    if (savingNotificationEmails) return;
    setEditingEmailIndex(null);
    setEditingEmailValue("");
    setNewEmailValue("");
    setEmailsDialogOpen(false);
  }

  function beginEditEmail(index: number) {
    setEditingEmailIndex(index);
    setEditingEmailValue(notificationEmails[index] ?? "");
  }

  async function saveEditedEmail() {
    if (editingEmailIndex === null) return;

    const normalized = editingEmailValue.trim().toLowerCase();
    if (!normalized) {
      toast.error("Email is required");
      return;
    }
    if (!isValidEmail(normalized)) {
      toast.error("Enter a valid email");
      return;
    }
    if (notificationEmails.some((item, index) => index !== editingEmailIndex && item === normalized)) {
      toast.error("Email already exists");
      return;
    }

    const next = notificationEmails.map((item, index) =>
      index === editingEmailIndex ? normalized : item
    );
    const saved = await persistNotificationEmails(next, "Email updated");
    if (saved) {
      setEditingEmailIndex(null);
      setEditingEmailValue("");
    }
  }

  async function deleteEmail(index: number) {
    const target = notificationEmails[index];
    if (!target) return;
    const confirmed = window.confirm(`Delete email "${target}"?`);
    if (!confirmed) return;

    const next = notificationEmails.filter((_, currentIndex) => currentIndex !== index);
    await persistNotificationEmails(next, "Email deleted");
    if (editingEmailIndex === index) {
      setEditingEmailIndex(null);
      setEditingEmailValue("");
    }
  }

  async function addEmail() {
    const normalized = newEmailValue.trim().toLowerCase();
    if (!normalized) {
      toast.error("Email is required");
      return;
    }
    if (!isValidEmail(normalized)) {
      toast.error("Enter a valid email");
      return;
    }
    if (notificationEmails.includes(normalized)) {
      toast.error("Email already exists");
      return;
    }

    const next = [...notificationEmails, normalized];
    const saved = await persistNotificationEmails(next, "Email added");
    if (saved) {
      setNewEmailValue("");
    }
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        await Promise.all([loadProject(), loadViewer()]);
        await loadDirectory("");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load project");
      } finally {
        setLoadingTree(false);
      }
    }

    void bootstrap();
  }, [loadDirectory, loadProject, loadViewer]);

  useEffect(() => {
    if (
      !showDiff ||
      diffMode !== "compare_any_two_commits" ||
      !loadedFile ||
      loadedFile.kind !== "text" ||
      !baseCommitSha ||
      !headCommitSha
    ) {
      return;
    }

    void loadCommitComparison(loadedFile.path, baseCommitSha, headCommitSha);
  }, [baseCommitSha, diffMode, headCommitSha, loadCommitComparison, loadedFile, showDiff]);

  const toggleFolder = useCallback(
    async (path: string) => {
      const next = new Set(expanded);

      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
        if (!treeMap[path]) {
          await loadDirectory(path);
        }
      }

      setExpanded(next);
    },
    [expanded, loadDirectory, treeMap]
  );

  async function saveFile() {
    if (!loadedFile || loadedFile.kind !== "text") return;
    const isDraftNewFile = !loadedFile.sha;
    const trimmedContent = editedContent.trim();

    if (isDraftNewFile && !trimmedContent) {
      toast.error("Add content before saving this new file.");
      return;
    }

    const message = window.prompt(
      "Commit message",
      `${isDraftNewFile ? "Create" : "Update"} ${loadedFile.path} from DocVerCtl`
    );
    if (!message) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/file`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          path: loadedFile.path,
          content: editedContent,
          sha: loadedFile.sha,
          message
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save file");
      }

      toast.success(`Committed changes (${payload.commitSha.slice(0, 7)})`);
      if (pendingNewFilePath === loadedFile.path) {
        setPendingNewFilePath(null);
      }
      await loadFile(loadedFile.path);
      await refreshTree();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save file");
    } finally {
      setSaving(false);
    }
  }

  async function createFileInDirectory(basePath: string) {
    if (hasUnsavedNewFile) {
      toast.error("Save the current new file before opening more actions.");
      return;
    }

    const name = window.prompt("File name", "new-file.md");
    if (!name) return;
    const parsed = parseFileInput(name);
    if ("error" in parsed) {
      toast.error(parsed.error);
      return;
    }
    const path = joinPath(basePath, parsed.path);

    try {
      const response = await fetch(`/api/projects/${projectId}/file?path=${encodeURIComponent(path)}`, {
        cache: "no-store"
      });
      if (response.ok) {
        toast.error("A file with this path already exists.");
        return;
      }
      if (response.status !== 404) {
        throw new Error("Could not validate file path");
      }
      setSelectedPath(path);
      setLoadedFile({
        kind: "text",
        path,
        name: parsed.name,
        size: 0
      });
      setOriginalContent("");
      setEditedContent("");
      setMarkdownViewMode(path.endsWith(".md") ? "preview" : "edit");
      setFileHistory(null);
      setCommitComparison(null);
      setBaseCommitSha("");
      setHeadCommitSha("");
      setShowDiff(false);
      setPendingNewFilePath(path);
      toast.success("New file draft opened. Add content, then save to commit.");
    } catch {
      toast.error("Could not validate the file path right now.");
    }
  }

  async function createFolderInDirectory(basePath: string) {
    if (hasUnsavedNewFile) {
      toast.error("Save the current new file before opening more actions.");
      return;
    }

    const folderName = window.prompt("Folder name", "new-folder");
    if (!folderName) return;
    const parsed = parseFolderName(folderName);
    if ("error" in parsed) {
      toast.error(parsed.error);
      return;
    }

    const readmePath = joinPath(basePath, `${parsed.folder}/README.md`);
    const readmeContent = window.prompt(
      `Starter content for ${parsed.folder}/README.md`,
      "Describe this folder."
    );
    if (!readmeContent || !readmeContent.trim()) {
      toast.error("A folder needs a README.md with content before it can be saved.");
      return;
    }

    const response = await fetch(`/api/projects/${projectId}/file`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        path: readmePath,
        content: readmeContent,
        message: `Create folder ${parsed.folder} from DocVerCtl`
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to create folder");
    }

    toast.success(`Folder created with ${parsed.folder}/README.md`);
    await refreshTree();
  }

  async function deleteFilePath(filePath: string, sha: string) {
    const response = await fetch(`/api/projects/${projectId}/file?path=${encodeURIComponent(filePath)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sha,
        message: `Delete ${filePath} from DocVerCtl`
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to delete file");
    }
  }

  async function deletePath(entry: TreeEntry) {
    const ok = window.confirm(`Delete ${entry.path}?`);
    if (!ok) return;

    if (entry.type === "file") {
      if (!entry.sha) {
        throw new Error("Missing file SHA");
      }
      await deleteFilePath(entry.path, entry.sha);
      toast.success("File deleted");
      if (selectedPath === entry.path) {
        setSelectedPath(null);
        setLoadedFile(null);
        setFileHistory(null);
      }
      await refreshTree();
      return;
    }

    const files: TreeEntry[] = [];

    async function collect(dirPath: string) {
      const response = await fetch(`/api/projects/${projectId}/tree?path=${encodeURIComponent(dirPath)}`, {
        cache: "no-store"
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to list directory");
      }

      for (const item of payload.entries as TreeEntry[]) {
        if (item.type === "dir") {
          await collect(item.path);
        } else {
          files.push(item);
        }
      }
    }

    await collect(entry.path);

    for (const file of files) {
      if (!file.sha) continue;
      await deleteFilePath(file.path, file.sha);
    }

    toast.success("Folder deleted");
    await refreshTree();
  }

  async function renamePath(entry: TreeEntry) {
    const next = window.prompt("New path", entry.path);
    if (!next || next.trim() === entry.path) return;

    const response = await fetch(`/api/projects/${projectId}/rename`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fromPath: entry.path,
        toPath: next.trim()
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to rename path");
    }

    toast.success("Path updated");
    if (selectedPath === entry.path) {
      setSelectedPath(next.trim());
      await loadFile(next.trim());
    }
    await refreshTree();
  }

  function blockContextMenuIfDraft(event: React.MouseEvent) {
    if (!hasUnsavedNewFile) return false;
    event.preventDefault();
    toast.error("Save the new file draft before opening the context menu.");
    return true;
  }

  async function runTreeAction(action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not complete this action");
    }
  }

  function renderNodes(basePath: string, depth = 0) {
    const entries = treeMap[basePath] ?? [];

    return entries
      .filter((entry) => pathMatchesSearch(entry, treeMap, search))
      .map((entry) => {
        const isFolder = entry.type === "dir";
        const isExpanded = expanded.has(entry.path);
        const isSelected = selectedPath === entry.path;

        return (
          <div key={entry.path}>
            <ContextMenu>
              <ContextMenuTrigger
                asChild
                onContextMenu={(event) => {
                  void blockContextMenuIfDraft(event);
                }}
              >
                <button
                  className={`flex w-full items-center gap-1 rounded px-2 py-1 text-left text-sm hover:bg-accent ${
                    isSelected ? "bg-accent" : ""
                  }`}
                  style={{ paddingLeft: `${depth * 14 + 8}px` }}
                  onClick={() => {
                    if (isFolder) {
                      void toggleFolder(entry.path);
                      return;
                    }

                    if (pendingNewFilePath && pendingNewFilePath !== entry.path) {
                      const discardDraft = window.confirm(
                        "You have an unsaved new file draft. Continue and discard it?"
                      );
                      if (!discardDraft) return;
                      setPendingNewFilePath(null);
                    }

                    if (isDirty) {
                      const continueOpen = window.confirm(
                        "You have unsaved changes. Continue and discard them?"
                      );
                      if (!continueOpen) return;
                    }

                    setSelectedPath(entry.path);
                    void loadFile(entry.path);
                  }}
                >
                  {isFolder ? (
                    isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )
                  ) : (
                    <span className="w-3.5" />
                  )}

                  {isFolder ? (
                    isExpanded ? (
                      <FolderOpen className="h-4 w-4 text-sky-700" />
                    ) : (
                      <Folder className="h-4 w-4 text-sky-700" />
                    )
                  ) : (
                    <File className="h-4 w-4 text-muted-foreground" />
                  )}

                  <span className="truncate">{entry.name}</span>
                </button>
              </ContextMenuTrigger>
              {!hasUnsavedNewFile ? (
                <ContextMenuContent>
                  <ContextMenuItem
                    onSelect={() =>
                      void runTreeAction(() =>
                        createFileInDirectory(isFolder ? entry.path : getParentPath(entry.path))
                      )
                    }
                  >
                    New File
                  </ContextMenuItem>
                  {isFolder ? (
                    <ContextMenuItem onSelect={() => void runTreeAction(() => createFolderInDirectory(entry.path))}>
                      New Folder
                    </ContextMenuItem>
                  ) : null}
                  <ContextMenuItem onSelect={() => void runTreeAction(() => renamePath(entry))}>
                    Rename / Move
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => void runTreeAction(() => deletePath(entry))}>
                    {isFolder ? "Delete Folder" : "Delete File"}
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => void runTreeAction(async () => refreshTree())}>
                    Refresh
                  </ContextMenuItem>
                </ContextMenuContent>
              ) : null}
            </ContextMenu>

            {isFolder && isExpanded ? <div>{renderNodes(entry.path, depth + 1)}</div> : null}
          </div>
        );
      });
  }

  const diffOriginalContent =
    diffMode === "compare_any_two_commits"
      ? commitComparison?.base.content ?? ""
      : diffMode === "last_commit_vs_previous_commit"
      ? fileHistory?.previous?.content ?? ""
      : fileHistory?.latest.content ?? originalContent;

  const diffModifiedContent =
    diffMode === "compare_any_two_commits"
      ? commitComparison?.head.content ?? ""
      : diffMode === "last_commit_vs_previous_commit"
      ? fileHistory?.latest.content ?? originalContent
      : editedContent;

  const leftMeta =
    diffMode === "compare_any_two_commits"
      ? commitComparison?.base
      : diffMode === "last_commit_vs_previous_commit"
      ? fileHistory?.previous
      : fileHistory?.latest;

  const rightMeta =
    diffMode === "compare_any_two_commits" ? commitComparison?.head : fileHistory?.latest;
  const canUseCommitComparison = (fileHistory?.commits.length ?? 0) >= 2;
  const isDiffLoading = loadingHistory || loadingCommitComparison;

  return (
    <section className="flex h-[calc(100vh-56px)] w-full">
      <ContextMenu>
        <ContextMenuTrigger
          asChild
          onContextMenu={(event) => {
            void blockContextMenuIfDraft(event);
          }}
        >
          <aside className="w-full max-w-sm border-r bg-card">
            <div className="flex items-center gap-2 border-b p-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search loaded tree"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <Button size="icon" variant="outline" onClick={() => void refreshTree()}>
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>

            <div className="border-b px-3 py-2 text-xs text-muted-foreground">
              {project ? `${project.name} · ${project.repoOwner}/${project.repoName}` : "Loading project..."}
            </div>
            {hasUnsavedNewFile ? (
              <div className="border-b px-3 py-2 text-xs text-amber-700">
                A new file draft is open. Save it to enable context menu actions.
              </div>
            ) : null}

            <div className="h-[calc(100%-93px)] overflow-y-auto p-2">
              {loadingTree ? (
                <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading tree...
                </div>
              ) : (
                <div>{renderNodes("")}</div>
              )}
            </div>
          </aside>
        </ContextMenuTrigger>
        {!hasUnsavedNewFile ? (
          <ContextMenuContent>
            <ContextMenuItem onSelect={() => void runTreeAction(() => createFileInDirectory(""))}>
              New File
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => void runTreeAction(() => createFolderInDirectory(""))}>
              New Folder
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => void runTreeAction(async () => refreshTree())}>
              Refresh
            </ContextMenuItem>
          </ContextMenuContent>
        ) : null}
      </ContextMenu>

      <main className="flex-1 overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="truncate text-sm text-muted-foreground">
            {breadcrumbs.length ? breadcrumbs.join(" / ") : "No file selected"}
          </div>
          <TooltipProvider delayDuration={120}>
          <div className="flex items-center gap-2">
            {viewerIsAdmin ? (
              <IconToolbarButton
                variant="outline"
                tooltip="User Emails"
                onClick={() => openEmailsDialog()}
                disabled={savingNotificationEmails}
              >
                <Mail className="h-4 w-4" />
              </IconToolbarButton>
            ) : null}
            {loadedFile?.kind === "text" ? (
              <>
                <IconToolbarButton
                  variant="outline"
                  tooltip={showDiff ? "Hide changes" : "View changes"}
                  onClick={() => setShowDiff((prev) => !prev)}
                >
                  <FileDiff className="h-4 w-4" />
                </IconToolbarButton>
                {isMarkdownFile && !showDiff ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setMarkdownViewMode((prev) => (prev === "preview" ? "edit" : "preview"))
                    }
                  >
                    {markdownViewMode === "preview" ? "Edit" : "Preview"}
                  </Button>
                ) : null}
                {showDiff ? (
                  <>
                    <IconToolbarButton
                      variant={diffMode === "unsaved_vs_last_commit" ? "secondary" : "outline"}
                      tooltip="Current changes vs last commit"
                      onClick={() => setDiffMode("unsaved_vs_last_commit")}
                    >
                      <PencilLine className="h-4 w-4" />
                    </IconToolbarButton>
                    <IconToolbarButton
                      variant={
                        diffMode === "last_commit_vs_previous_commit" ? "secondary" : "outline"
                      }
                      tooltip="Last commit vs previous commit"
                      onClick={() => setDiffMode("last_commit_vs_previous_commit")}
                    >
                      <History className="h-4 w-4" />
                    </IconToolbarButton>
                    <IconToolbarButton
                      variant={diffMode === "compare_any_two_commits" ? "secondary" : "outline"}
                      tooltip="Compare any two commits"
                      onClick={() => setDiffMode("compare_any_two_commits")}
                      disabled={!canUseCommitComparison}
                    >
                      <GitCompareArrows className="h-4 w-4" />
                    </IconToolbarButton>
                    <IconToolbarButton
                      variant="outline"
                      tooltip={
                        diffView === "side"
                          ? "Switch to unified diff"
                          : "Switch to side-by-side diff"
                      }
                      onClick={() =>
                        setDiffView((prev) => (prev === "side" ? "unified" : "side"))
                      }
                    >
                      {diffView === "side" ? (
                        <AlignJustify className="h-4 w-4" />
                      ) : (
                        <Columns2 className="h-4 w-4" />
                      )}
                    </IconToolbarButton>
                  </>
                ) : null}
                <Button size="sm" onClick={() => void saveFile()} disabled={!isDirty || saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>
              </>
            ) : null}
          </div>
          </TooltipProvider>
        </div>

        <div className="h-[calc(100%-45px)]">
          {loadingFile ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading file...
            </div>
          ) : !loadedFile ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select a file from the explorer.
            </div>
          ) : loadedFile.kind === "text" ? (
            showDiff ? (
              <div className="flex h-full flex-col">
                {diffMode === "compare_any_two_commits" ? (
                  <div className="grid grid-cols-1 gap-2 border-b bg-muted/20 px-3 py-2 md:grid-cols-2">
                    <label className="text-xs text-muted-foreground">
                      Base commit
                      <select
                        className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-xs"
                        value={baseCommitSha}
                        onChange={(event) => {
                          setBaseCommitSha(event.target.value);
                        }}
                      >
                        {(fileHistory?.commits ?? []).map((commit) => (
                          <option key={`base-${commit.sha}`} value={commit.sha}>
                            {formatCommitOptionLabel(commit)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Target commit
                      <select
                        className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-xs"
                        value={headCommitSha}
                        onChange={(event) => {
                          setHeadCommitSha(event.target.value);
                        }}
                      >
                        {(fileHistory?.commits ?? []).map((commit) => (
                          <option key={`head-${commit.sha}`} value={commit.sha}>
                            {formatCommitOptionLabel(commit)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-2 border-b bg-muted/40 px-3 py-2 text-xs">
                  <div className="rounded border bg-card px-2 py-1">
                    <p className="font-semibold">
                      {diffMode === "compare_any_two_commits"
                        ? "Base Commit"
                        : diffMode === "last_commit_vs_previous_commit"
                        ? "Previous Commit"
                        : "Last Commit"}
                    </p>
                    <p>Hash: {shortSha(leftMeta?.sha)}</p>
                    <p>Date: {formatCommitDate(leftMeta?.date)}</p>
                    <p className="truncate">Message: {leftMeta?.message ?? "(no message)"}</p>
                  </div>
                  <div className="rounded border bg-card px-2 py-1">
                    <p className="font-semibold">
                      {diffMode === "compare_any_two_commits"
                        ? "Target Commit"
                        : diffMode === "last_commit_vs_previous_commit"
                          ? "Current Commit"
                          : "Current"}
                      {diffMode !== "compare_any_two_commits" ? (
                        <span className="ml-2 rounded bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">
                          CURRENT
                        </span>
                      ) : null}
                    </p>
                    <p>
                      Hash: {diffMode === "unsaved_vs_last_commit" ? "unsaved" : shortSha(rightMeta?.sha)}
                    </p>
                    <p>
                      Date: {diffMode === "unsaved_vs_last_commit" ? "now" : formatCommitDate(rightMeta?.date)}
                    </p>
                    <p className="truncate">
                      Message: {diffMode === "unsaved_vs_last_commit" ? "Unsaved local edits" : rightMeta?.message ?? "(no message)"}
                    </p>
                  </div>
                </div>

                {isDiffLoading ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading history...
                  </div>
                ) : (
                  <MonacoDiffEditor
                    height="100%"
                    original={diffOriginalContent}
                    modified={diffModifiedContent}
                    language={loadedFile.path.endsWith(".md") ? "markdown" : "plaintext"}
                    options={{
                      readOnly: true,
                      renderSideBySide: diffView === "side",
                      minimap: { enabled: false }
                    }}
                  />
                )}
              </div>
            ) : (
              isMarkdownFile && markdownViewMode === "preview" ? (
                <div className="h-full overflow-y-auto p-6">
                  <article className="prose prose-slate mx-auto max-w-4xl dark:prose-invert prose-headings:font-semibold prose-table:block prose-table:w-full prose-table:overflow-x-auto prose-th:border prose-td:border prose-th:px-3 prose-td:px-3 prose-th:py-2 prose-td:py-2 prose-pre:rounded-md prose-pre:bg-slate-950 prose-code:before:content-none prose-code:after:content-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {editedContent || "_Empty markdown file_"}
                    </ReactMarkdown>
                  </article>
                </div>
              ) : (
                <MonacoEditor
                  height="100%"
                  value={editedContent}
                  language={loadedFile.path.endsWith(".md") ? "markdown" : "plaintext"}
                  onChange={(value) => setEditedContent(value ?? "")}
                  options={{
                    minimap: { enabled: false },
                    wordWrap: "on"
                  }}
                />
              )
            )
          ) : isPdf(loadedFile.path) ? (
            <iframe
              title={loadedFile.path}
              src={`/api/projects/${projectId}/file?path=${encodeURIComponent(loadedFile.path)}&raw=true`}
              className="h-full w-full"
            />
          ) : isDocx(loadedFile.path) ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">DOCX preview is disabled in MVP.</p>
              <Button asChild>
                <a
                  href={`/api/projects/${projectId}/file?path=${encodeURIComponent(loadedFile.path)}&raw=true`}
                  download
                >
                  Download .docx
                </a>
              </Button>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <File className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Binary file preview not supported.</p>
              <Button asChild>
                <a
                  href={`/api/projects/${projectId}/file?path=${encodeURIComponent(loadedFile.path)}&raw=true`}
                  download
                >
                  Download file
                </a>
              </Button>
            </div>
          )}
        </div>
      </main>
      {emailsDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">User Emails</h2>
                <p className="text-xs text-muted-foreground">
                  Add, edit, or delete notification recipients for this project.
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => closeEmailsDialog()}
                disabled={savingNotificationEmails}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 border-b p-4">
              <div className="flex items-center gap-2">
                <Input
                  value={newEmailValue}
                  onChange={(event) => setNewEmailValue(event.target.value)}
                  placeholder="Add email (name@example.com)"
                  disabled={savingNotificationEmails}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void addEmail()}
                  disabled={savingNotificationEmails}
                >
                  {savingNotificationEmails ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add Email
                </Button>
              </div>
            </div>
            <div className="max-h-[45vh] space-y-2 overflow-y-auto p-4">
              {notificationEmails.length === 0 ? (
                <p className="rounded border border-dashed p-3 text-sm text-muted-foreground">
                  No user emails have been added for notifications.
                </p>
              ) : (
                notificationEmails.map((email, index) => (
                  <div key={`${email}-${index}`} className="flex items-center gap-2 rounded border p-2">
                    {editingEmailIndex === index ? (
                      <>
                        <Input
                          value={editingEmailValue}
                          onChange={(event) => setEditingEmailValue(event.target.value)}
                          placeholder="name@example.com"
                          disabled={savingNotificationEmails}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => void saveEditedEmail()}
                          disabled={savingNotificationEmails}
                        >
                          {savingNotificationEmails ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingEmailIndex(null);
                            setEditingEmailValue("");
                          }}
                          disabled={savingNotificationEmails}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 truncate text-sm">{email}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => beginEditEmail(index)}
                          disabled={savingNotificationEmails}
                        >
                          <PencilLine className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => void deleteEmail(index)}
                          disabled={savingNotificationEmails}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end border-t px-4 py-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => closeEmailsDialog()}
                disabled={savingNotificationEmails}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
