import { AllowlistPageClient } from "@/components/admin/allowlist-page-client";
import { redirect } from "next/navigation";

import { findAllowedUser } from "@/lib/allowlist";
import { getAuthSession } from "@/lib/auth";

export default async function AllowlistPage() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    redirect("/");
  }

  const allowedUser = await findAllowedUser({
    githubUserId: Number(session.user.id),
    githubLogin: session.user.login
  });

  if (!allowedUser?.isAdmin) {
    redirect("/projects");
  }

  return <AllowlistPageClient />;
}
