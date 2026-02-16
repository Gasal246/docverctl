import { z } from "zod";

const safePath = z
  .string()
  .min(1)
  .max(512)
  .refine((value) => !value.includes(".."), "Path must not include '..'");

export const createProjectSchema = z.object({
  mode: z.enum(["connect", "create"]).default("connect"),
  name: z.string().min(2).max(120),
  owner: z.string().min(1).max(100),
  repoName: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9_.-]+$/, "Invalid repository name"),
  notificationEmails: z.array(z.string().email()).optional().default([])
});

export const repoCheckSchema = z.object({
  owner: z.string().min(1),
  repoName: z.string().min(1)
});

export const fileQuerySchema = z.object({
  path: safePath
});

export const treeQuerySchema = z.object({
  path: z.string().max(512).optional().default("")
});

export const upsertFileSchema = z.object({
  path: safePath,
  content: z.string(),
  message: z.string().min(4).max(280),
  sha: z.string().optional()
});

export const deleteFileSchema = z.object({
  path: safePath,
  sha: z.string().min(1),
  message: z.string().min(4).max(280)
});

export const renameSchema = z.object({
  fromPath: safePath,
  toPath: safePath
});

export const addAllowUserSchema = z.object({
  githubUserId: z.number().int().positive(),
  githubLogin: z.string().min(1),
  isAdmin: z.boolean().optional().default(false)
});
