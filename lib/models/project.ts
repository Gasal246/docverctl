import { Schema, model, models, Types } from "mongoose";

export interface Project {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  defaultBranch: string;
  notificationEmails: string[];
  createdByGithubId: number;
  createdAt: Date;
  updatedAt: Date;
  isArchived: boolean;
}

const projectSchema = new Schema<Project>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    repoOwner: { type: String, required: true },
    repoName: { type: String, required: true },
    repoUrl: { type: String, required: true },
    defaultBranch: { type: String, default: "main" },
    notificationEmails: { type: [String], default: [] },
    createdByGithubId: { type: Number, required: true },
    isArchived: { type: Boolean, default: false }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

projectSchema.index({ repoOwner: 1, repoName: 1 }, { unique: true });

export const ProjectModel =
  models.Project || model<Project>("Project", projectSchema);
