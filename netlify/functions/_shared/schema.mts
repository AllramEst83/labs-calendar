/**
 * _shared/schema.mts — Zod schemas for CalendarEvent validation.
 *
 * Shared between client-side (if imported via ESM) and server-side functions.
 * Strips HTML from all string fields and enforces length limits.
 */

import { z } from 'zod';

/** Strip HTML tags from a string. */
const sanitize = (val: string) => val.replace(/<[^>]*>/g, '').trim();

/** A sanitized string field that strips HTML and trims whitespace. */
const safeStr = (max: number) =>
  z.string()
    .max(max, `Max ${max} characters`)
    .transform(sanitize);

const optionalSafeStr = (max: number) =>
  z.string().max(max).transform(sanitize).optional().or(z.literal('')).transform(v => v || undefined);

/** Language pair { code, name } — at least one field required per entry. */
const LanguageSchema = z.object({
  code: z.string().max(10).transform(sanitize).default(''),
  name: z.string().max(80).transform(sanitize).default(''),
}).refine((l) => l.code.length > 0 || l.name.length > 0, {
  message: 'Each language must have a code or name',
});

/** Valid event category values */
const CategoryEnum = z.enum([
  'meeting',
  'workshop',
  'deadline',
  'social',
  'personal',
  'rtmp',
  'internal',
  'other',
]);

/** Full event schema (used for type checking and responses) */
export const CalendarEventSchema = z.object({
  id:          z.string().uuid(),
  title:       safeStr(200),
  start:       z.string().datetime({ message: 'start must be a valid ISO datetime' }),
  end:         z.string().datetime().optional(),
  allDay:      z.boolean().default(false),
  description: optionalSafeStr(2000),
  location:    optionalSafeStr(300),
  roomName:    optionalSafeStr(200),
  serviceType: optionalSafeStr(200),
  rtmpLink:    z.string().url().max(500).optional().or(z.literal('')).transform(v => v || undefined),
  streamUrl:   optionalSafeStr(500),
  streamKey:   optionalSafeStr(500),
  category:    CategoryEnum.default('other'),
  color:       z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color').optional(),
  languages:   z.array(LanguageSchema).max(20).default([]),
  createdAt:   z.string().datetime(),
  updatedAt:   z.string().datetime(),
});

/** Schema for creating a new event (no id/timestamps) */
export const CreateEventSchema = CalendarEventSchema.omit({
  id:        true,
  createdAt: true,
  updatedAt: true,
}).strict();

/** Schema for updating an event (all fields except id/timestamps are optional) */
export const UpdateEventSchema = CalendarEventSchema.omit({
  id:        true,
  createdAt: true,
  updatedAt: true,
}).partial().strict();

export type CalendarEvent = z.infer<typeof CalendarEventSchema>;
export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;
