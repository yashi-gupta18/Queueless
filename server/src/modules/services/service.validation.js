import mongoose from 'mongoose';
import { z } from 'zod';

const objectId = z.string().refine((value) => mongoose.isValidObjectId(value), {
  message: 'Invalid ObjectId',
});

export const createServiceSchema = z.object({
  body: z.object({
    branch: objectId,
    name: z.string().trim().min(2, 'Name must be at least 2 characters'),
    description: z.string().trim().min(1, 'Description is required'),
    estimatedServiceTime: z.number().int().min(1, 'Estimated service time must be at least 1 minute'),
    isActive: z.boolean().optional(),
  }),
});

export const updateServiceSchema = z.object({
  params: z.object({
    id: objectId,
  }),
  body: z
    .object({
      branch: objectId.optional(),
      name: z.string().trim().min(2, 'Name must be at least 2 characters').optional(),
      description: z.string().trim().min(1, 'Description is required').optional(),
      estimatedServiceTime: z
        .number()
        .int()
        .min(1, 'Estimated service time must be at least 1 minute')
        .optional(),
      isActive: z.boolean().optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: 'At least one field is required',
    }),
});

export const serviceIdSchema = z.object({
  params: z.object({
    id: objectId,
  }),
});
