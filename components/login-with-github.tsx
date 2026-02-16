"use client";

import { signIn } from "next-auth/react";
import { Github } from "lucide-react";

import { Button } from "@/components/ui/button";

export function LoginWithGitHub() {
  return (
    <Button onClick={() => signIn("github", { callbackUrl: "/projects" })}>
      <Github className="h-4 w-4" />
      Login with GitHub
    </Button>
  );
}
