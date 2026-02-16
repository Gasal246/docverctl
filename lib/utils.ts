import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function decodeBase64(content: string) {
  return Buffer.from(content, "base64").toString("utf-8");
}

export function encodeBase64(content: string) {
  return Buffer.from(content, "utf-8").toString("base64");
}
