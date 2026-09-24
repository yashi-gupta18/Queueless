import mongoose from 'mongoose';

export const QUEUE_STATUSES = ['OPEN', 'CLOSED'];

const queueSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: QUEUE_STATUSES,
      default: 'OPEN',
      index: true,
    },
    currentToken: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalServed: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

queueSchema.index({ branch: 1, service: 1 }, { unique: true });
queueSchema.index({ branch: 1, status: 1 });

queueSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const Queue = mongoose.model('Queue', queueSchema);

export default Queue;
