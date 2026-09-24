import mongoose from 'mongoose';
import { z } from 'zod';

const objectId = z.string().refine((value) => mongoose.isValidObjectId(value), {
  message: 'Invalid ObjectId',
});

const status = z.enum(['OPEN', 'CLOSED']);

export const createCounterSchema = z.object({
  body: z.object({
    branch: objectId,
    service: objectId,
    counterNumber: z.number().int().min(1, 'Counter number must be at least 1'),
    status: status.optional(),
  }),
});

export const updateCounterSchema = z.object({
  params: z.object({
    id: objectId,
  }),
  body: z
    .object({
      branch: objectId.optional(),
      service: objectId.optional(),
      counterNumber: z.number().int().min(1, 'Counter number must be at least 1').optional(),
      status: status.optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: 'At least one field is required',
    }),
});

export const counterIdSchema = z.object({
  params: z.object({
    id: objectId,
  }),
});
