import { ProjectWorkspace } from "@/components/file-explorer/project-workspace";

export default async function ProjectPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return <ProjectWorkspace projectId={projectId} />;
}
