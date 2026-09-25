import mongoose from 'mongoose';
import { z } from 'zod';

const objectId = z.string().refine((value) => mongoose.isValidObjectId(value), {
  message: 'Invalid ObjectId',
});

export const queueIdSchema = z.object({
  params: z.object({
    queueId: objectId,
  }),
});

export const queueByIdSchema = z.object({
  params: z.object({
    id: objectId,
  }),
});

export const createQueueSchema = z.object({
  body: z.object({
    branch: objectId,
    service: objectId,
  }),
});

export const listQueuesSchema = z.object({
  query: z.object({
    branch: objectId.optional(),
    service: objectId.optional(),
    status: z.enum(['OPEN', 'CLOSED']).optional(),
  }),
});

export const entryIdSchema = z.object({
  params: z.object({
    entryId: objectId,
  }),
});
