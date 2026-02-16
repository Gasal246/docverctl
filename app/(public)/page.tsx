import { redirect } from "next/navigation";

import { getAuthSession } from "@/lib/auth";
import { LoginWithGitHub } from "@/components/login-with-github";

export default async function HomePage() {
  const session = await getAuthSession();

  if (session?.user?.id) {
    redirect("/projects");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-slate-100 to-cyan-100 px-6">
      <section className="w-full max-w-xl rounded-2xl border bg-card p-10 shadow-sm">
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          GitHub-first documentation control
        </p>
        <h1 className="mb-4 text-3xl font-semibold">Manage project docs directly from private repos</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Authenticate with GitHub, browse repositories as a filesystem, edit markdown/text,
          and commit changes safely.
        </p>
        <LoginWithGitHub />
      </section>
    </main>
  );
}
