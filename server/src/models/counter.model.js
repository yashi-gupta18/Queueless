import mongoose from 'mongoose';

export const COUNTER_STATUSES = ['OPEN', 'CLOSED'];

const counterSchema = new mongoose.Schema(
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
    counterNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: COUNTER_STATUSES,
      default: 'CLOSED',
      index: true,
    },
  },
  { timestamps: true }
);

counterSchema.index({ branch: 1, counterNumber: 1 }, { unique: true });
counterSchema.index({ branch: 1, service: 1 });

counterSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const Counter = mongoose.model('Counter', counterSchema);

export default Counter;
