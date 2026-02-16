import { Schema, model, models } from "mongoose";

export interface AllowedUser {
  githubUserId: number;
  githubLogin: string;
  isAdmin: boolean;
  addedBy?: string;
  addedAt: Date;
}

const allowedUserSchema = new Schema<AllowedUser>(
  {
    githubUserId: { type: Number, required: true, unique: true, index: true },
    githubLogin: { type: String, required: true, unique: true, index: true },
    isAdmin: { type: Boolean, default: false },
    addedBy: { type: String },
    addedAt: { type: Date, default: () => new Date() }
  },
  { versionKey: false }
);

allowedUserSchema.pre("save", function normalizeLogin(next) {
  this.githubLogin = this.githubLogin.toLowerCase();
  next();
});

export const AllowedUserModel =
  models.AllowedUser || model<AllowedUser>("AllowedUser", allowedUserSchema);
