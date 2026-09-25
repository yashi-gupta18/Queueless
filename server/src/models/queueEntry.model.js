import mongoose from 'mongoose';

export const QUEUE_ENTRY_STATUSES = [
  'WAITING',
  'CALLED',
  'IN_SERVICE',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];

export const QUEUE_ENTRY_PRIORITIES = ['NORMAL', 'PRIORITY'];

const queueEntrySchema = new mongoose.Schema(
  {
    queue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Queue',
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenNumber: {
      type: Number,
      required: true,
      min: 1,
      index: true,
    },
    status: {
      type: String,
      enum: QUEUE_ENTRY_STATUSES,
      default: 'WAITING',
      index: true,
    },
    priority: {
      type: String,
      enum: QUEUE_ENTRY_PRIORITIES,
      default: 'NORMAL',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    calledAt: Date,
    serviceStartedAt: Date,
    completedAt: Date,
    skippedAt: Date,
    noShowAt: Date,
    waitTime: {
      type: Number,
      min: 0,
    },
    serviceTime: {
      type: Number,
      min: 0,
    },
    calledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    serviceStartedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    skippedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    noShowBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    skipReason: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

queueEntrySchema.index({ queue: 1, status: 1, joinedAt: 1 });
queueEntrySchema.index(
  { customer: 1, queue: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['WAITING', 'CALLED', 'IN_SERVICE'] },
    },
  }
);
queueEntrySchema.index({ queue: 1, tokenNumber: 1 }, { unique: true });
queueEntrySchema.index(
  { queue: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['CALLED', 'IN_SERVICE'] },
    },
  }
);

queueEntrySchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const QueueEntry = mongoose.model('QueueEntry', queueEntrySchema);

export default QueueEntry;
