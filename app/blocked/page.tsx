import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Blocked"
};

export default function BlockedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-lg rounded-xl border bg-card p-8">
        <h1 className="text-2xl font-semibold">You are not authorized</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your GitHub account is not allowlisted. Contact an administrator to request access.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link href="/">Go back</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
