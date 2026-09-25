import {
  callNextCustomer,
  completeService,
  closeQueue,
  createQueue,
  deleteQueue,
  getMyActiveQueueEntry,
  getMyPosition,
  getQueueById,
  getQueueStatus,
  getQueues,
  getStaffQueueDetails,
  getStaffQueues,
  joinQueue,
  leaveQueue,
  markInService,
  markNoShow,
  openQueue,
  skipEntry,
} from './queue.service.js';

export const create = async (req, res, next) => {
  try {
    const queue = await createQueue(req.body);
    res.status(201).json({ success: true, message: 'Queue created successfully', data: { queue } });
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const queues = await getQueues(req.query);
    res.json({ success: true, data: { queues } });
  } catch (error) {
    next(error);
  }
};

export const listStaffQueues = async (req, res, next) => {
  try {
    const queues = await getStaffQueues(req.user);
    res.json({ success: true, data: { queues } });
  } catch (error) {
    next(error);
  }
};

export const getStaffQueue = async (req, res, next) => {
  try {
    const data = await getStaffQueueDetails(req.params.queueId, req.user);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const queue = await getQueueById(req.params.id);
    res.json({ success: true, data: { queue } });
  } catch (error) {
    next(error);
  }
};

export const open = async (req, res, next) => {
  try {
    const queue = await openQueue(req.params.id);
    res.json({ success: true, message: 'Queue opened successfully', data: { queue } });
  } catch (error) {
    next(error);
  }
};

export const close = async (req, res, next) => {
  try {
    const queue = await closeQueue(req.params.id);
    res.json({ success: true, message: 'Queue closed successfully', data: { queue } });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    await deleteQueue(req.params.id);
    res.json({ success: true, message: 'Queue deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const join = async (req, res, next) => {
  try {
    const data = await joinQueue(req.params.queueId, req.user.id);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const leave = async (req, res, next) => {
  try {
    const entry = await leaveQueue(req.params.queueId, req.user.id);
    res.json({ success: true, message: 'Left queue successfully', data: { entry } });
  } catch (error) {
    next(error);
  }
};

export const status = async (req, res, next) => {
  try {
    const data = await getQueueStatus(req.params.queueId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const myPosition = async (req, res, next) => {
  try {
    const data = await getMyPosition(req.params.queueId, req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const myActiveEntry = async (req, res, next) => {
  try {
    const data = await getMyActiveQueueEntry(req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const callNext = async (req, res, next) => {
  try {
    const entry = await callNextCustomer(req.params.queueId, req.user);
    res.json({ success: true, data: { entry } });
  } catch (error) {
    next(error);
  }
};

export const inService = async (req, res, next) => {
  try {
    const entry = await markInService(req.params.entryId, req.user);
    res.json({ success: true, data: { entry } });
  } catch (error) {
    next(error);
  }
};

export const complete = async (req, res, next) => {
  try {
    const entry = await completeService(req.params.entryId, req.user);
    res.json({ success: true, data: { entry } });
  } catch (error) {
    next(error);
  }
};

export const skip = async (req, res, next) => {
  try {
    const entry = await skipEntry(req.params.entryId, req.user);
    res.json({ success: true, data: { entry } });
  } catch (error) {
    next(error);
  }
};

export const noShow = async (req, res, next) => {
  try {
    const entry = await markNoShow(req.params.entryId, req.user);
    res.json({ success: true, data: { entry } });
  } catch (error) {
    next(error);
  }
};
