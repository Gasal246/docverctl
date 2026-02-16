import { Schema, model, models, Types } from "mongoose";

export interface FileLock {
  projectId: Types.ObjectId;
  path: string;
  lockedByGithubId: number;
  lockedByLogin: string;
  acquiredAt: Date;
  expiresAt: Date;
}

const fileLockSchema = new Schema<FileLock>(
  {
    projectId: { type: Schema.Types.ObjectId, required: true, index: true },
    path: { type: String, required: true, index: true },
    lockedByGithubId: { type: Number, required: true, index: true },
    lockedByLogin: { type: String, required: true },
    acquiredAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, required: true, index: true }
  },
  { versionKey: false }
);

fileLockSchema.index({ projectId: 1, path: 1 }, { unique: true });

export const FileLockModel =
  models.FileLock || model<FileLock>("FileLock", fileLockSchema);
