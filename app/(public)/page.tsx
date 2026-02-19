import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAuthSession } from "@/lib/auth";
import { LoginWithGitHub } from "@/components/login-with-github";

export const metadata: Metadata = {
  title: "Login"
};

export default async function HomePage() {
  const session = await getAuthSession();

  if (session?.user?.id) {
    redirect("/projects");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/30 to-accent/40 px-6">
      <section className="w-full max-w-xl rounded-2xl border bg-card p-10 shadow-sm">
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Document Version Control ( Doc-Ver-Ctl )
        </p>
        <h1 className="mb-4 text-3xl font-semibold">Hey! Wassup ?</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          You should have a <u>basic git knowledge</u> to use this app, but no worries, we will guide you through the process.
        </p>
        <LoginWithGitHub />
      </section>
    </main>
  );
}
