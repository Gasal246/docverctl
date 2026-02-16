import { Schema, model, models, Types } from "mongoose";

export type AuditAction =
  | "PROJECT_CREATE"
  | "FILE_CREATE"
  | "FILE_EDIT"
  | "FILE_DELETE"
  | "FOLDER_CREATE"
  | "RENAME"
  | "MOVE"
  | "COMMIT";

export interface AuditLog {
  actorGithubId: number;
  actorLogin: string;
  action: AuditAction;
  projectId: Types.ObjectId;
  path?: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLog>(
  {
    actorGithubId: { type: Number, required: true, index: true },
    actorLogin: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, required: true, index: true },
    path: { type: String },
    meta: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: () => new Date(), index: true }
  },
  { versionKey: false }
);

export const AuditLogModel =
  models.AuditLog || model<AuditLog>("AuditLog", auditLogSchema);
