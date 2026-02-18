import { NextRequest, NextResponse } from "next/server";

import { requireAdmin, requireApiSession } from "@/lib/api-auth";
import { handleApiError } from "@/lib/http";
import { ProjectModel } from "@/lib/models";
import { getProjectOrThrow } from "@/lib/project-access";
import { updateProjectEmailsSchema } from "@/lib/schemas";

function normalizeEmails(emails: string[]) {
  return [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { allowedUser } = await requireApiSession(req);
    requireAdmin(allowedUser.isAdmin);

    const { id } = await params;
    const project = await getProjectOrThrow(id);

    return NextResponse.json({
      notificationEmails: project.notificationEmails ?? []
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { allowedUser } = await requireApiSession(req);
    requireAdmin(allowedUser.isAdmin);

    const { id } = await params;
    await getProjectOrThrow(id);

    const payload = updateProjectEmailsSchema.parse(await req.json());
    const notificationEmails = normalizeEmails(payload.notificationEmails);

    await ProjectModel.findByIdAndUpdate(
      id,
      {
        notificationEmails
      },
      { new: true }
    )
      .exec();
    const updatedProject = await getProjectOrThrow(id);

    return NextResponse.json({
      notificationEmails: updatedProject.notificationEmails ?? notificationEmails
    });
  } catch (error) {
    return handleApiError(error);
  }
}
