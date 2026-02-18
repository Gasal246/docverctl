import type { Metadata } from "next";

import { ProjectWorkspace } from "@/components/file-explorer/project-workspace";
import { getProjectOrThrow } from "@/lib/project-access";

export async function generateMetadata({
  params
}: {
  params: Promise<{ projectId: string }>;
}): Promise<Metadata> {
  const { projectId } = await params;

  try {
    const project = await getProjectOrThrow(projectId);
    return {
      title: project.name
    };
  } catch {
    return {
      title: "Project"
    };
  }
}

export default async function ProjectPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return <ProjectWorkspace projectId={projectId} />;
}
