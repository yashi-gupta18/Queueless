import mongoose from 'mongoose';
import { z } from 'zod';

const objectId = z.string().refine((value) => mongoose.isValidObjectId(value), {
  message: 'Invalid ObjectId',
});

const locationSchema = z.object({
  type: z.literal('Point').default('Point'),
  coordinates: z
    .array(z.number())
    .length(2, 'Coordinates must be [longitude, latitude]'),
});

export const createBranchSchema = z.object({
  body: z.object({
    organization: objectId,
    name: z.string().trim().min(2, 'Name must be at least 2 characters'),
    address: z.string().trim().min(1, 'Address is required'),
    city: z.string().trim().min(1, 'City is required'),
    state: z.string().trim().min(1, 'State is required'),
    pincode: z.string().trim().min(1, 'Pincode is required'),
    phone: z.string().trim().min(1, 'Phone is required'),
    location: locationSchema.optional(),
    isActive: z.boolean().optional(),
  }),
});

export const updateBranchSchema = z.object({
  params: z.object({
    id: objectId,
  }),
  body: z
    .object({
      organization: objectId.optional(),
      name: z.string().trim().min(2, 'Name must be at least 2 characters').optional(),
      address: z.string().trim().min(1, 'Address is required').optional(),
      city: z.string().trim().min(1, 'City is required').optional(),
      state: z.string().trim().min(1, 'State is required').optional(),
      pincode: z.string().trim().min(1, 'Pincode is required').optional(),
      phone: z.string().trim().min(1, 'Phone is required').optional(),
      location: locationSchema.optional(),
      isActive: z.boolean().optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: 'At least one field is required',
    }),
});

export const branchIdSchema = z.object({
  params: z.object({
    id: objectId,
  }),
});
