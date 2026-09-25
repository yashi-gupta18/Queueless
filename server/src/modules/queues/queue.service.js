import Branch from '../../models/branch.model.js';
import Queue from '../../models/queue.model.js';
import QueueEntry from '../../models/queueEntry.model.js';
import Service from '../../models/service.model.js';
import * as redisQueueService from '../../services/redisQueueService.js';
import { QUEUE_SOCKET_EVENTS } from '../../socket/socket.events.js';
import { emitQueueEvent, emitQueueUpdated } from '../../socket/socket.service.js';
import ApiError from '../../utils/apiError.js';

const ACTIVE_STATUSES = ['WAITING', 'CALLED', 'IN_SERVICE'];
const STAFF_ACTIVE_STATUSES = ['CALLED', 'IN_SERVICE'];

const formatTokenNumber = (tokenNumber) => `A-${String(tokenNumber).padStart(3, '0')}`;

const buildEntrySocketPayload = (entry) => ({
  _id: entry.id || entry._id?.toString(),
  queue: entry.queue?.toString(),
  tokenNumber: entry.tokenNumber,
  tokenLabel: formatTokenNumber(entry.tokenNumber),
  status: entry.status,
  priority: entry.priority,
  joinedAt: entry.joinedAt,
  calledAt: entry.calledAt,
  serviceStartedAt: entry.serviceStartedAt,
  completedAt: entry.completedAt,
});

const minutesBetween = (start, end) => {
  if (!start || !end) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
};

const getQueueOrThrow = async (queueId) => {
  const queue = await Queue.findById(queueId)
    .populate({
      path: 'branch',
      select: 'name city state organization',
      populate: { path: 'organization', select: 'name' },
    })
    .populate('service', 'name estimatedServiceTime');

  if (!queue) {
    throw new ApiError(404, 'Queue not found');
  }

  return queue;
};

const assertQueueHasService = (queue) => {
  if (!queue.service) {
    throw new ApiError(400, 'Queue does not have an available service');
  }
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

const assertStaffCanOperateQueue = async (user, queueOrId) => {
  const queue = typeof queueOrId === 'string' || queueOrId?._bsontype === 'ObjectId'
    ? await Queue.findById(queueOrId)
    : queueOrId;

  if (!queue) {
    throw new ApiError(404, 'Queue not found');
  }

  if (user.role === 'ADMIN') {
    return queue;
  }

  if (!user.assignedBranch || !user.assignedService) {
    throw new ApiError(403, 'Staff user is not assigned to a branch and service');
  }

  if (
    queue.branch.toString() !== user.assignedBranch.toString()
    || queue.service.toString() !== user.assignedService.toString()
  ) {
    throw new ApiError(403, 'You are not assigned to operate this queue');
  }

  return queue;
};

const getPeopleAhead = async (entry) => {
  const redisPosition = await redisQueueService.getQueuePosition(entry.queue, entry.id || entry._id);

  if (redisPosition) {
    return redisPosition.peopleAhead;
  }

  return QueueEntry.countDocuments({
    queue: entry.queue,
    status: 'WAITING',
    joinedAt: { $lt: entry.joinedAt },
  });
};

const buildPositionPayload = async (entry, queue) => {
  assertQueueHasService(queue);

  const peopleAhead = await getPeopleAhead(entry);
  const estimatedWaitTime = peopleAhead * queue.service.estimatedServiceTime;

  return {
    entry,
    tokenNumber: entry.tokenNumber,
    tokenLabel: formatTokenNumber(entry.tokenNumber),
    queueId: entry.queue,
    status: entry.status,
    joinedAt: entry.joinedAt,
    peopleAhead,
    position: peopleAhead + 1,
    estimatedWaitTime,
  };
};

const populateQueue = (query) => {
  return query
    .populate({
      path: 'branch',
      select: 'name city state organization',
      populate: { path: 'organization', select: 'name' },
    })
    .populate('service', 'name estimatedServiceTime');
};

const ensureBranchAndService = async (branchId, serviceId) => {
  const [branch, service] = await Promise.all([
    Branch.findById(branchId),
    Service.findById(serviceId),
  ]);

  if (!branch) {
    throw new ApiError(404, 'Branch not found');
  }

  if (!service) {
    throw new ApiError(404, 'Service not found');
  }

  if (service.branch.toString() !== branch.id) {
    throw new ApiError(400, 'Service does not belong to the selected branch');
  }

  return { branch, service };
};

const ensureNoOpenQueue = async (branch, service, excludeId = null) => {
  const query = { branch, service, status: 'OPEN' };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const existingQueue = await Queue.exists(query);

  if (existingQueue) {
    throw new ApiError(409, 'An open queue already exists for this branch and service');
  }
};

export const getQueues = async (filters = {}) => {
  const query = {};

  if (filters.branch) query.branch = filters.branch;
  if (filters.service) query.service = filters.service;
  if (filters.status) query.status = filters.status;

  return populateQueue(Queue.find(query)).sort({ createdAt: -1 });
};

export const getStaffQueues = async (user) => {
  const query = { status: 'OPEN' };

  if (user.role === 'STAFF') {
    if (!user.assignedBranch || !user.assignedService) {
      throw new ApiError(403, 'Staff user is not assigned to a branch and service');
    }

    query.branch = user.assignedBranch;
    query.service = user.assignedService;
  }

  return populateQueue(Queue.find(query)).sort({ createdAt: -1 });
};

export const getStaffQueueDetails = async (queueId, user) => {
  const queue = await populateQueue(Queue.findById(queueId));

  if (!queue) {
    throw new ApiError(404, 'Queue not found');
  }

  await assertStaffCanOperateQueue(user, queue);

  const [waitingCount, currentCustomer, nextWaitingCustomer, waitingCustomers] = await Promise.all([
    QueueEntry.countDocuments({ queue: queueId, status: 'WAITING' }),
    QueueEntry.findOne({ queue: queueId, status: { $in: STAFF_ACTIVE_STATUSES } })
      .populate('customer', 'name email')
      .sort({ calledAt: 1 }),
    QueueEntry.findOne({ queue: queueId, status: 'WAITING' })
      .populate('customer', 'name email')
      .sort({ joinedAt: 1 }),
    QueueEntry.find({ queue: queueId, status: 'WAITING' })
      .populate('customer', 'name email')
      .sort({ joinedAt: 1 })
      .limit(25),
  ]);

  return {
    queue,
    branch: queue.branch,
    service: queue.service,
    status: queue.status,
    currentCustomer,
    currentToken: queue.currentToken,
    waitingCount,
    nextWaitingCustomer,
    waitingCustomers,
    totalServed: queue.totalServed,
  };
};

export const createQueue = async (data) => {
  await ensureBranchAndService(data.branch, data.service);
  await ensureNoOpenQueue(data.branch, data.service);

  const queue = await Queue.create({
    branch: data.branch,
    service: data.service,
    status: 'CLOSED',
    currentToken: 0,
    totalServed: 0,
  });

  return populateQueue(Queue.findById(queue.id));
};

export const getQueueById = async (id) => {
  return getQueueOrThrow(id);
};

export const openQueue = async (id) => {
  const queue = await Queue.findById(id);

  if (!queue) {
    throw new ApiError(404, 'Queue not found');
  }

  if (queue.status === 'OPEN') {
    throw new ApiError(400, 'Queue is already open');
  }

  await ensureBranchAndService(queue.branch, queue.service);
  await ensureNoOpenQueue(queue.branch, queue.service, queue.id);

  queue.status = 'OPEN';
  queue.openedAt = new Date();
  queue.closedAt = null;
  await queue.save();
  await redisQueueService.initializeQueue(queue);

  const updatedQueue = await populateQueue(Queue.findById(queue.id));
  emitQueueEvent(QUEUE_SOCKET_EVENTS.OPENED, queue.id, { queue: updatedQueue });
  emitQueueUpdated(queue.id, { queue: updatedQueue });

  return updatedQueue;
};

export const closeQueue = async (id) => {
  const queue = await Queue.findById(id);

  if (!queue) {
    throw new ApiError(404, 'Queue not found');
  }

  if (queue.status === 'CLOSED') {
    throw new ApiError(400, 'Queue is already closed');
  }

  queue.status = 'CLOSED';
  queue.closedAt = new Date();
  await queue.save();
  await redisQueueService.clearQueue(queue.id);

  const updatedQueue = await populateQueue(Queue.findById(queue.id));
  emitQueueEvent(QUEUE_SOCKET_EVENTS.CLOSED, queue.id, { queue: updatedQueue });
  emitQueueUpdated(queue.id, { queue: updatedQueue });

  return updatedQueue;
};

export const deleteQueue = async (id) => {
  const queue = await Queue.findById(id);

  if (!queue) {
    throw new ApiError(404, 'Queue not found');
  }

  if (queue.status === 'OPEN') {
    throw new ApiError(400, 'Cannot delete an open queue');
  }

  const queueId = queue.id;
  await queue.deleteOne();
  emitQueueUpdated(queueId, { deleted: true });
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

  const existingQueue = await Queue.findById(queueId).populate('service', 'estimatedServiceTime name');

  if (!existingQueue) {
    throw new ApiError(404, 'Queue not found');
  }

  if (existingQueue.status !== 'OPEN') {
    throw new ApiError(400, 'Queue is closed');
  }

  assertQueueHasService(existingQueue);

  const queue = await Queue.findOneAndUpdate(
    { _id: queueId, status: 'OPEN' },
    { $inc: { currentToken: 1 } },
    { new: true }
  ).populate('service', 'estimatedServiceTime name');

  if (!queue) {
    throw new ApiError(400, 'Queue is closed');
  }

  let entry;

  try {
    entry = await QueueEntry.create({
      queue: queue.id,
      customer: customerId,
      tokenNumber: queue.currentToken,
      status: 'WAITING',
      priority: 'NORMAL',
      joinedAt: new Date(),
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'Customer is already in this queue');
    }

    throw error;
  }

  const position = await buildPositionPayload(entry, queue);
  await redisQueueService.addCustomer(entry);
  emitQueueEvent(QUEUE_SOCKET_EVENTS.JOINED, queue.id, { entry: buildEntrySocketPayload(entry) });
  emitQueueUpdated(queue.id, { entry: buildEntrySocketPayload(entry) });

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
  await redisQueueService.removeCustomer(queueId, entry.id);

  emitQueueEvent(QUEUE_SOCKET_EVENTS.LEFT, queueId, { entry: buildEntrySocketPayload(entry) });
  emitQueueUpdated(queueId, { entry: buildEntrySocketPayload(entry) });

  return entry;
};

export const getMyActiveQueueEntry = async (customerId) => {
  const entry = await QueueEntry.findOne({
    customer: customerId,
    status: { $in: ACTIVE_STATUSES },
  }).sort({ joinedAt: -1 });

  if (!entry) {
    return { entry: null };
  }

  const queue = await getQueueOrThrow(entry.queue);
  const position = entry.status === 'WAITING'
    ? await buildPositionPayload(entry, queue)
    : {
        entry,
        tokenNumber: entry.tokenNumber,
        tokenLabel: formatTokenNumber(entry.tokenNumber),
        queueId: entry.queue,
        status: entry.status,
        joinedAt: entry.joinedAt,
        peopleAhead: 0,
        position: 0,
        estimatedWaitTime: 0,
      };

  return {
    ...position,
    queue,
  };
};

export const getQueueStatus = async (queueId) => {
  const queue = await getQueueOrThrow(queueId);
  const [waitingCount, calledCount, inServiceCount] = await Promise.all([
    redisQueueService.getWaitingCount(queueId),
    QueueEntry.countDocuments({ queue: queueId, status: 'CALLED' }),
    QueueEntry.countDocuments({ queue: queueId, status: 'IN_SERVICE' }),
  ]);

  return {
    queue,
    waitingCount: waitingCount ?? await QueueEntry.countDocuments({ queue: queueId, status: 'WAITING' }),
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
      tokenNumber: entry.tokenNumber,
      tokenLabel: formatTokenNumber(entry.tokenNumber),
      queueId: entry.queue,
      status: entry.status,
      joinedAt: entry.joinedAt,
      peopleAhead: 0,
      position: 0,
      estimatedWaitTime: 0,
    };
  }

  return buildPositionPayload(entry, queue);
};

export const callNextCustomer = async (queueId, user) => {
  const queue = await assertStaffCanOperateQueue(user, queueId);

  if (queue.status !== 'OPEN') {
    throw new ApiError(400, 'Queue is closed');
  }

  let entry;
  const redisNext = await redisQueueService.getNextCustomer(queueId);

  if (redisNext?.status === 'ACTIVE') {
    throw new ApiError(409, 'Complete the current customer before calling the next customer.');
  }

  if (redisNext?.status === 'EMPTY') {
    await redisQueueService.rebuildQueueFromMongoDB(queue);
    const rebuiltRedisNext = await redisQueueService.getNextCustomer(queueId);

    if (rebuiltRedisNext?.status === 'ACTIVE') {
      throw new ApiError(409, 'Complete the current customer before calling the next customer.');
    }

    if (rebuiltRedisNext?.status === 'OK') {
      redisNext.status = rebuiltRedisNext.status;
      redisNext.entryId = rebuiltRedisNext.entryId;
    } else {
      throw new ApiError(404, 'No customers are waiting.');
    }
  }

  try {
    if (redisNext?.status === 'OK') {
      entry = await QueueEntry.findOneAndUpdate(
        { _id: redisNext.entryId, queue: queueId, status: 'WAITING' },
        { status: 'CALLED', calledAt: new Date(), calledBy: user.id },
        { new: true }
      ).populate('customer', 'name email');

      if (!entry) {
        await redisQueueService.rebuildQueueFromMongoDB(queue);
        throw new ApiError(409, 'Queue state changed. Please try calling the next customer again.');
      }
    } else {
      const activeEntry = await QueueEntry.exists({
        queue: queueId,
        status: { $in: STAFF_ACTIVE_STATUSES },
      });

      if (activeEntry) {
        throw new ApiError(409, 'Complete the current customer before calling the next customer.');
      }

      entry = await QueueEntry.findOneAndUpdate(
        { queue: queueId, status: 'WAITING' },
        { status: 'CALLED', calledAt: new Date(), calledBy: user.id },
        { new: true, sort: { joinedAt: 1 } }
      ).populate('customer', 'name email');
    }
  } catch (error) {
    if (error.code === 11000) {
      await redisQueueService.rebuildQueueFromMongoDB(queue);
      throw new ApiError(409, 'Complete the current customer before calling the next customer.');
    }

    throw error;
  }

  if (!entry) {
    throw new ApiError(404, 'No customers are waiting.');
  }

  await redisQueueService.markServing(entry);
  emitQueueEvent(QUEUE_SOCKET_EVENTS.CALLED, queueId, { entry: buildEntrySocketPayload(entry) });
  emitQueueUpdated(queueId, { entry: buildEntrySocketPayload(entry) });

  return entry;
};

const getEntryWithQueueOrThrow = async (entryId) => {
  const entry = await getEntryOrThrow(entryId);

  const queue = await Queue.findById(entry.queue);

  if (!queue) {
    throw new ApiError(404, 'Queue not found');
  }

  return { entry, queue };
};

export const markInService = async (entryId, user) => {
  const { entry, queue } = await getEntryWithQueueOrThrow(entryId);
  await assertStaffCanOperateQueue(user, queue);
  assertEntryStatus(entry, ['CALLED']);

  entry.status = 'IN_SERVICE';
  entry.serviceStartedAt = new Date();
  entry.serviceStartedBy = user.id;
  await entry.save();
  const populatedEntry = await entry.populate('customer', 'name email');
  await redisQueueService.markServing(populatedEntry);
  emitQueueEvent(QUEUE_SOCKET_EVENTS.SERVICE_STARTED, entry.queue, { entry: buildEntrySocketPayload(populatedEntry) });
  emitQueueUpdated(entry.queue, { entry: buildEntrySocketPayload(populatedEntry) });
  return populatedEntry;
};

export const completeService = async (entryId, user) => {
  const { entry, queue } = await getEntryWithQueueOrThrow(entryId);
  await assertStaffCanOperateQueue(user, queue);
  assertEntryStatus(entry, ['IN_SERVICE']);

  const completedAt = new Date();
  entry.status = 'COMPLETED';
  entry.completedAt = completedAt;
  entry.completedBy = user.id;
  entry.waitTime = minutesBetween(entry.joinedAt, entry.calledAt);
  entry.serviceTime = minutesBetween(entry.serviceStartedAt, completedAt);
  await entry.save();
  await Queue.findByIdAndUpdate(entry.queue, { $inc: { totalServed: 1 } });
  await redisQueueService.markCompleted(entry.queue, entry.id);

  const populatedEntry = await entry.populate('customer', 'name email');
  emitQueueEvent(QUEUE_SOCKET_EVENTS.COMPLETED, entry.queue, { entry: buildEntrySocketPayload(populatedEntry) });
  emitQueueUpdated(entry.queue, { entry: buildEntrySocketPayload(populatedEntry) });
  return populatedEntry;
};

export const skipEntry = async (entryId, user) => {
  const { entry, queue } = await getEntryWithQueueOrThrow(entryId);
  await assertStaffCanOperateQueue(user, queue);
  assertEntryStatus(entry, ['CALLED']);

  entry.status = 'CANCELLED';
  entry.skippedAt = new Date();
  entry.skippedBy = user.id;
  entry.skipReason = 'Skipped by staff';
  await entry.save();
  await redisQueueService.removeCustomer(entry.queue, entry.id);

  const populatedEntry = await entry.populate('customer', 'name email');
  emitQueueEvent(QUEUE_SOCKET_EVENTS.SKIPPED, entry.queue, { entry: buildEntrySocketPayload(populatedEntry) });
  emitQueueUpdated(entry.queue, { entry: buildEntrySocketPayload(populatedEntry) });
  return populatedEntry;
};

export const markNoShow = async (entryId, user) => {
  const { entry, queue } = await getEntryWithQueueOrThrow(entryId);
  await assertStaffCanOperateQueue(user, queue);
  assertEntryStatus(entry, ['CALLED']);

  entry.status = 'NO_SHOW';
  entry.noShowAt = new Date();
  entry.noShowBy = user.id;
  await entry.save();
  await redisQueueService.removeCustomer(entry.queue, entry.id);

  const populatedEntry = await entry.populate('customer', 'name email');
  emitQueueEvent(QUEUE_SOCKET_EVENTS.NO_SHOW, entry.queue, { entry: buildEntrySocketPayload(populatedEntry) });
  emitQueueUpdated(entry.queue, { entry: buildEntrySocketPayload(populatedEntry) });
  return populatedEntry;
};
