import { z } from 'zod';

const nameInList = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.string().min(1).max(120));

export const rsvpStatusSchema = z.union([
  z.literal('attending'),
  z.literal('declined'),
  z.literal('maybe'),
]);

export const rsvpSubmitSchema = z
  .object({
    rsvpStatus: rsvpStatusSchema,
    plusOnesNames: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((raw) => {
        if (raw === undefined) return [] as string[];
        const arr = Array.isArray(raw) ? raw : [raw];
        return arr
          .flatMap((s) => s.split(/\r?\n/))
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      })
      .pipe(z.array(nameInList).max(10)),
    dietaryRestrictions: z
      .string()
      .optional()
      .transform((s) => {
        const t = s?.trim();
        return t && t.length > 0 ? t.slice(0, 200) : undefined;
      }),
    notes: z
      .string()
      .optional()
      .transform((s) => {
        const t = s?.trim();
        return t && t.length > 0 ? t.slice(0, 500) : undefined;
      }),
  })
  .superRefine((data, ctx) => {
    if (data.rsvpStatus !== 'attending' && data.plusOnesNames.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['plusOnesNames'],
        message: 'Accompagnants autorisés uniquement si présence confirmée',
      });
    }
  });

export type RsvpSubmitInput = z.infer<typeof rsvpSubmitSchema>;
