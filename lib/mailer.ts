import nodemailer from "nodemailer";

import { env } from "@/lib/env";

let transporter: nodemailer.Transporter | null = null;

function hasMailerConfig() {
  return Boolean(
    true &&
      env.SMTP_HOST &&
      env.SMTP_USER &&
      env.SMTP_PASS &&
      env.MAIL_FROM
  );
}

export function mailNotificationsEnabled() {
  return hasMailerConfig();
}

function getTransporter() {
  if (!hasMailerConfig()) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: Boolean(env.SMTP_SECURE),
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      }
    });
  }

  return transporter;
}

export async function sendMail(input: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}) {
  const tx = getTransporter();
  if (!tx) {
    return { skipped: true };
  }

  await tx.sendMail({
    from: env.MAIL_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html
  });

  return { skipped: false };
}
