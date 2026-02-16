"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AllowUser = {
  _id: string;
  githubUserId: number;
  githubLogin: string;
  isAdmin: boolean;
  addedBy?: string;
};

export function AllowlistPageClient() {
  const [users, setUsers] = useState<AllowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [githubUserId, setGithubUserId] = useState("");
  const [githubLogin, setGithubLogin] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  async function loadUsers() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/allowlist", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load allowlist");
      }

      setUsers(payload.users ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load allowlist");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function addUser() {
    const parsedId = Number(githubUserId);
    if (!parsedId || !githubLogin.trim()) {
      toast.error("GitHub user ID and login are required");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/admin/allowlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubUserId: parsedId,
          githubLogin: githubLogin.trim(),
          isAdmin
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to add user");
      }

      toast.success("Allowlist entry added");
      setGithubUserId("");
      setGithubLogin("");
      setIsAdmin(false);
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Allowlist Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="GitHub user ID (numeric)"
              value={githubUserId}
              onChange={(e) => setGithubUserId(e.target.value)}
            />
            <Input
              placeholder="GitHub login"
              value={githubLogin}
              onChange={(e) => setGithubLogin(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
            />
            Grant admin role
          </label>
          <Button disabled={saving} onClick={() => void addUser()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add user
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users in allowlist.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {users.map((user) => (
                <div
                  key={user._id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <span>
                    @{user.githubLogin} ({user.githubUserId})
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {user.isAdmin ? "Admin" : "Member"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
