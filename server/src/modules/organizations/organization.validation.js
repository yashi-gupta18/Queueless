import mongoose from 'mongoose';
import { z } from 'zod';

const objectId = z.string().refine((value) => mongoose.isValidObjectId(value), {
  message: 'Invalid ObjectId',
});

export const createOrganizationSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters'),
    description: z.string().trim().min(1, 'Description is required'),
  }),
});

export const updateOrganizationSchema = z.object({
  params: z.object({
    id: objectId,
  }),
  body: z
    .object({
      name: z.string().trim().min(2, 'Name must be at least 2 characters').optional(),
      description: z.string().trim().min(1, 'Description is required').optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: 'At least one field is required',
    }),
});

export const organizationIdSchema = z.object({
  params: z.object({
    id: objectId,
  }),
});
