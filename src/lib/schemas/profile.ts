/* ══ schemas/profile.ts — Zod validation schemas for user profile data ══ */
import { z } from "zod";

export const socialLinkSchema = z.object({
  platform: z.enum(["github", "twitter", "linkedin", "website", "discord"]),
  url: z.string().url("Must be a valid URL").max(200, "URL is too long"),
});

export const userProfileSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(60, "Name must not exceed 60 characters")
    .trim(),
  bio: z
    .string()
    .max(280, "Bio cannot exceed 280 characters")
    .optional()
    .default(""),
  title: z
    .string()
    .max(80, "Title cannot exceed 80 characters")
    .optional()
    .default(""),
  skills: z
    .array(z.string().min(1).max(30))
    .max(25, "Maximum 25 skills allowed")
    .default([]),
  socials: z.array(socialLinkSchema).max(5).default([]),
  isOpenToMentorship: z.boolean().default(false),
  preferredLanguages: z
    .array(z.string().min(1).max(30))
    .max(10, "Maximum 10 languages allowed")
    .default([]),
});

export type UserProfileInput = z.infer<typeof userProfileSchema>;
export type SocialLinkInput = z.infer<typeof socialLinkSchema>;

export function validateUserProfile(data: unknown) {
  return userProfileSchema.safeParse(data);
}
