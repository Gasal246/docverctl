import { getServerSession, NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";

import { isAllowlisted, findAllowedUser } from "@/lib/allowlist";
import { env } from "@/lib/env";

function extractGitHubIdentity(profile?: unknown) {
  const source = profile as Record<string, unknown> | undefined;
  const rawLogin = source?.login;
  const rawId = source?.id;

  const githubLogin =
    typeof rawLogin === "string" ? rawLogin.toLowerCase() : undefined;
  const githubUserId =
    typeof rawId === "number"
      ? rawId
      : typeof rawId === "string"
        ? Number(rawId)
        : undefined;

  return { githubLogin, githubUserId };
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt"
  },
  providers: [
    GitHubProvider({
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "read:user user:email repo"
        }
      }
    })
  ],
  callbacks: {
    async signIn({ profile }) {
      const { githubLogin, githubUserId } = extractGitHubIdentity(profile);

      const allowed = await isAllowlisted({ githubLogin, githubUserId });
      if (!allowed) {
        return "/blocked";
      }

      return true;
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === "github") {
        token.accessToken = account.access_token;
      }

      if (profile) {
        const { githubLogin, githubUserId } = extractGitHubIdentity(profile);

        token.githubLogin = githubLogin;
        token.githubId = githubUserId;

        const allowedUser = await findAllowedUser({
          githubUserId,
          githubLogin
        });

        token.isAdmin = Boolean(allowedUser?.isAdmin);
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.githubId ?? "");
        session.user.login = String(token.githubLogin ?? "");
        session.user.isAdmin = Boolean(token.isAdmin);
      }

      return session;
    }
  },
  pages: {
    signIn: "/"
  },
  secret: env.NEXTAUTH_SECRET
};

export function getAuthSession() {
  return getServerSession(authOptions);
}
