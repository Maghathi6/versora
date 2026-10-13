import { z } from 'zod';

export const createConversationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Conversation title must not be empty')
    .max(255, 'Conversation title cannot exceed 255 characters')
    .optional(),
});

export const updateConversationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Conversation title must not be empty')
    .max(255, 'Conversation title cannot exceed 255 characters'),
});

export const sendMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Message content must not be empty')
    .max(10000, 'Message content cannot exceed 10,000 characters'),
});

export const quickActionSchema = z.object({
  action: z.enum([
    'explain-artifact',
    'summarize-commit',
    'explain-impact',
    'review-assistance',
    'project-summary',
  ]),
  targetId: z.string().trim().optional(),
  customPrompt: z.string().trim().max(2000).optional(),
});

export type CreateConversationSchema = z.infer<typeof createConversationSchema>;
export type UpdateConversationSchema = z.infer<typeof updateConversationSchema>;
export type SendMessageSchema = z.infer<typeof sendMessageSchema>;
export type QuickActionSchema = z.infer<typeof quickActionSchema>;
