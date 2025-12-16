import { z } from "zod/v4";

export const generateCalendarSchema = z.object({
  campaignId: z.string().uuid("Invalid campaign ID format"),
  weekStartDate: z.string().date().optional(),
});

export const generateNextWeekSchema = z.object({
  campaignId: z.string().uuid("Invalid campaign ID format"),
});

export function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join(", ");
}
