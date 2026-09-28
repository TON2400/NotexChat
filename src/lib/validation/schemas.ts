import { z } from "zod";

export const usernameSchema = z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9._-]+$/, "Username may contain letters, numbers, dot, underscore, and hyphen");
export const passwordSchema = z.string().min(8).max(128);
export const displayNameSchema = z.string().trim().min(1).max(50);
export const inviteKeySchema = z.string().trim().min(1).max(200);
export const registerSchema = z.object({ username: usernameSchema, password: passwordSchema, inviteKey: inviteKeySchema });
export const messageSchema = z.object({ conversationId: z.string().uuid(), content: z.string().trim().min(1).max(2000) });
