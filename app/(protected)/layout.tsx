import { redirect } from "next/navigation";

import { findAllowedUser } from "@/lib/allowlist";
import { getAuthSession } from "@/lib/auth";
import { TopBar } from "@/components/top-bar";

export default async function ProtectedLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    redirect("/");
  }

  const allowedUser = await findAllowedUser({
    githubUserId: Number(session.user.id),
    githubLogin: session.user.login
  });

  if (!allowedUser) {
    redirect("/blocked");
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        user={{
          login: session.user.login,
          image: session.user.image,
          isAdmin: allowedUser.isAdmin
        }}
      />
      <main className="pt-14">{children}</main>
    </div>
  );
}
