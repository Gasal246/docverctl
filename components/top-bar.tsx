"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { FolderGit2, ShieldCheck, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

interface TopBarProps {
  user: {
    login: string;
    image?: string | null;
    isAdmin?: boolean;
  };
}

export function TopBar({ user }: TopBarProps) {
  return (
    <header className="fixed top-0 z-40 flex h-14 w-full items-center justify-between border-b bg-card/95 px-4 backdrop-blur">
      <div className="flex items-center gap-5">
        <Link href="/projects" className="flex items-center gap-2 text-sm font-semibold">
          <FolderGit2 className="h-4 w-4" />
          DocVerCtl
        </Link>
        {user.isAdmin ? (
          <Link
            href="/admin/allowlist"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Allowlist
          </Link>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-md bg-secondary px-2 py-1 text-xs">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt={user.login} className="h-6 w-6 rounded-full" />
          ) : (
            <div className="h-6 w-6 rounded-full bg-primary/20" />
          )}
          <span>@{user.login}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
