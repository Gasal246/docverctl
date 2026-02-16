import { sendMail, mailNotificationsEnabled } from "@/lib/mailer";

export interface ProjectNotificationPayload {
  recipients: string[];
  project: {
    name: string;
    repoOwner: string;
    repoName: string;
  };
  actor: {
    githubId: number;
    login: string;
  };
  action: string;
  commitMessage?: string;
  commitSha?: string;
  path?: string;
  occurredAt: Date;
}

function uniqueEmails(emails: string[]) {
  return [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

export async function notifyProjectChange(payload: ProjectNotificationPayload) {
  if (!mailNotificationsEnabled()) {
    return { skipped: true, reason: "mail-disabled" };
  }

  const recipients = uniqueEmails(payload.recipients);
  if (!recipients.length) {
    return { skipped: true, reason: "no-recipients" };
  }

  const timestamp = payload.occurredAt.toLocaleString();
  const subject = `[DocVerCtl] ${payload.project.name}: ${payload.action} by @${payload.actor.login}`;

  const lines = [
    `Project: ${payload.project.name}`,
    `Repository: ${payload.project.repoOwner}/${payload.project.repoName}`,
    `Action: ${payload.action}`,
    `Changed by: @${payload.actor.login} (GitHub ID: ${payload.actor.githubId})`,
    `Time: ${timestamp}`,
    payload.path ? `Path: ${payload.path}` : undefined,
    payload.commitSha ? `Commit: ${payload.commitSha}` : undefined,
    payload.commitMessage ? `Commit message: ${payload.commitMessage}` : undefined
  ].filter(Boolean) as string[];

  const text = lines.join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="margin: 0 0 12px;">DocVerCtl Project Update</h2>
      ${lines.map((line) => `<p style="margin: 4px 0;">${line}</p>`).join("")}
    </div>
  `;

  await sendMail({
    to: recipients,
    subject,
    text,
    html
  });

  return { skipped: false };
}
