/**
 * Shared helpers for the MCP tool modules: result wrappers, pagination
 * inputs, tool annotations, and the per-request tool context.
 */
import { z } from 'npm:zod@^4.3.6';

// PostgREST caps responses at max_rows = 1000 (see config.toml); every list
// tool paginates within that ceiling.
export const MAX_PAGE = 1000;
export const DEFAULT_PAGE = 200;

/**
 * Per-request context handed to every tool module. `supabase` is the
 * RLS-scoped client for the authenticated user — never a service-role client.
 */
export interface ToolContext {
  supabase: any;
  userId: string;
  email: string | null;
}

/** Wraps a value as an MCP text result carrying pretty-printed JSON. */
export function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

/** Wraps an error message as an MCP error result. */
export function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
}

/** Shared pagination inputs for list-style tools. */
export const paginationShape = {
  limit: z.number().int().min(1).max(MAX_PAGE).optional()
    .describe(`Max rows to return (default ${DEFAULT_PAGE}, max ${MAX_PAGE}).`),
  offset: z.number().int().min(0).optional().describe('Row offset for pagination (default 0).'),
};

export const uuid = (description: string) => z.string().uuid().describe(description);
export const dateKey = (description: string) =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe(description);

/** MCP tool annotations, so clients can tell reads from writes and gate deletes. */
export const READ_ONLY = { readOnlyHint: true, openWorldHint: false };
export const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
export const IDEMPOTENT_WRITE = { ...WRITE, idempotentHint: true };
export const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };

/** Capitalizes the first character, matching how both apps store item names. */
export function capitalizeFirst(name: string) {
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Lower-cases and trims an email, the form every *_shares table stores. */
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/**
 * Drops keys whose value is `undefined` so partial updates only send the
 * fields the caller supplied (explicit `null` still clears a column).
 */
export function definedOnly<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Splits an array into chunks no larger than `size` (for bulk inserts). */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
