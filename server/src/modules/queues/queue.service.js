import Queue from '../../models/queue.model.js';
import QueueEntry from '../../models/queueEntry.model.js';
import ApiError from '../../utils/apiError.js';

const ACTIVE_STATUSES = ['WAITING', 'CALLED', 'IN_SERVICE'];

const getQueueOrThrow = async (queueId) => {
  const queue = await Queue.findById(queueId).populate('service', 'estimatedServiceTime name');

  if (!queue) {
    throw new ApiError(404, 'Queue not found');
  }

  return queue;
};

const getEntryOrThrow = async (entryId) => {
  const entry = await QueueEntry.findById(entryId);

  if (!entry) {
    throw new ApiError(404, 'Queue entry not found');
  }

  return entry;
};

const assertEntryStatus = (entry, allowedStatuses) => {
  if (!allowedStatuses.includes(entry.status)) {
    throw new ApiError(400, `Invalid state transition from ${entry.status}`);
  }
};

const getPeopleAhead = async (entry) => {
  return QueueEntry.countDocuments({
    queue: entry.queue,
    status: 'WAITING',
    joinedAt: { $lt: entry.joinedAt },
  });
};

const buildPositionPayload = async (entry, queue) => {
  const peopleAhead = await getPeopleAhead(entry);
  const estimatedWaitTime = peopleAhead * queue.service.estimatedServiceTime;

  return {
    entry,
    peopleAhead,
    position: peopleAhead + 1,
    estimatedWaitTime,
  };
};

export const getQueues = async (filters = {}) => {
  const query = {};

  if (filters.branch) query.branch = filters.branch;
  if (filters.service) query.service = filters.service;
  if (filters.status) query.status = filters.status;

  return Queue.find(query)
    .populate('branch', 'name city state')
    .populate('service', 'name estimatedServiceTime')
    .sort({ createdAt: -1 });
};

export const joinQueue = async (queueId, customerId) => {
  const existingEntry = await QueueEntry.findOne({
    queue: queueId,
    customer: customerId,
    status: { $in: ACTIVE_STATUSES },
  });

  if (existingEntry) {
    throw new ApiError(409, 'Customer is already in this queue');
  }

  const queue = await Queue.findOneAndUpdate(
    { _id: queueId, status: 'OPEN' },
    { $inc: { currentToken: 1 } },
    { new: true }
  ).populate('service', 'estimatedServiceTime name');

  if (!queue) {
    throw new ApiError(400, 'Queue is closed or does not exist');
  }

  const entry = await QueueEntry.create({
    queue: queue.id,
    customer: customerId,
    tokenNumber: queue.currentToken,
  });

  const position = await buildPositionPayload(entry, queue);

  return {
    ...position,
    queue,
  };
};

export const leaveQueue = async (queueId, customerId) => {
  const entry = await QueueEntry.findOne({
    queue: queueId,
    customer: customerId,
    status: 'WAITING',
  });

  if (!entry) {
    throw new ApiError(400, 'Only waiting customers can leave the queue');
  }

  entry.status = 'CANCELLED';
  await entry.save();

  return entry;
};

export const getQueueStatus = async (queueId) => {
  const queue = await getQueueOrThrow(queueId);
  const [waitingCount, calledCount, inServiceCount] = await Promise.all([
    QueueEntry.countDocuments({ queue: queueId, status: 'WAITING' }),
    QueueEntry.countDocuments({ queue: queueId, status: 'CALLED' }),
    QueueEntry.countDocuments({ queue: queueId, status: 'IN_SERVICE' }),
  ]);

  return {
    queue,
    waitingCount,
    calledCount,
    inServiceCount,
    currentToken: queue.currentToken,
    totalServed: queue.totalServed,
  };
};

export const getMyPosition = async (queueId, customerId) => {
  const queue = await getQueueOrThrow(queueId);
  const entry = await QueueEntry.findOne({
    queue: queueId,
    customer: customerId,
    status: { $in: ACTIVE_STATUSES },
  });

  if (!entry) {
    throw new ApiError(404, 'Customer is not active in this queue');
  }

  if (entry.status !== 'WAITING') {
    return {
      entry,
      peopleAhead: 0,
      position: 0,
      estimatedWaitTime: 0,
    };
  }

  return buildPositionPayload(entry, queue);
};

export const callNextCustomer = async (queueId) => {
  await getQueueOrThrow(queueId);

  const entry = await QueueEntry.findOneAndUpdate(
    { queue: queueId, status: 'WAITING' },
    { status: 'CALLED', calledAt: new Date() },
    { new: true, sort: { joinedAt: 1 } }
  ).populate('customer', 'name email');

  if (!entry) {
    throw new ApiError(404, 'No waiting customers in this queue');
  }

  return entry;
};

export const markInService = async (entryId) => {
  const entry = await getEntryOrThrow(entryId);
  assertEntryStatus(entry, ['CALLED']);

  entry.status = 'IN_SERVICE';
  await entry.save();
  return entry;
};

export const completeService = async (entryId) => {
  const entry = await getEntryOrThrow(entryId);
  assertEntryStatus(entry, ['IN_SERVICE']);

  entry.status = 'COMPLETED';
  entry.completedAt = new Date();
  await entry.save();
  await Queue.findByIdAndUpdate(entry.queue, { $inc: { totalServed: 1 } });

  return entry;
};

export const skipEntry = async (entryId) => {
  const entry = await getEntryOrThrow(entryId);
  assertEntryStatus(entry, ['CALLED']);

  entry.status = 'WAITING';
  entry.calledAt = undefined;
  entry.joinedAt = new Date();
  await entry.save();

  return entry;
};

export const markNoShow = async (entryId) => {
  const entry = await getEntryOrThrow(entryId);
  assertEntryStatus(entry, ['CALLED']);

  entry.status = 'NO_SHOW';
  await entry.save();

  return entry;
};
