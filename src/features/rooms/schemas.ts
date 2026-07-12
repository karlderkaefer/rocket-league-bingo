import { z } from 'zod';

/**
 * Schema for validating share code input.
 * A valid share code is 1-8 alphanumeric characters.
 */
export const shareCodeSchema = z
  .string()
  .min(1, 'Share code is required')
  .max(8, 'Share code must be at most 8 characters')
  .regex(/^[a-zA-Z0-9]+$/, 'Share code must contain only letters and numbers');

/**
 * Schema for room creation parameters.
 * Requires at least one category ID to be selected.
 */
export const createRoomSchema = z.object({
  categoryIds: z
    .array(z.string().min(1))
    .min(1, 'At least one category must be selected'),
});

export type ShareCodeInput = z.infer<typeof shareCodeSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
