import {
  callNextCustomer,
  completeService,
  getMyPosition,
  getQueueStatus,
  getQueues,
  joinQueue,
  leaveQueue,
  markInService,
  markNoShow,
  skipEntry,
} from './queue.service.js';

export const list = async (req, res, next) => {
  try {
    const queues = await getQueues(req.query);
    res.json({ success: true, data: { queues } });
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

export const callNext = async (req, res, next) => {
  try {
    const entry = await callNextCustomer(req.params.queueId);
    res.json({ success: true, data: { entry } });
  } catch (error) {
    next(error);
  }
};

export const inService = async (req, res, next) => {
  try {
    const entry = await markInService(req.params.entryId);
    res.json({ success: true, data: { entry } });
  } catch (error) {
    next(error);
  }
};

export const complete = async (req, res, next) => {
  try {
    const entry = await completeService(req.params.entryId);
    res.json({ success: true, data: { entry } });
  } catch (error) {
    next(error);
  }
};

export const skip = async (req, res, next) => {
  try {
    const entry = await skipEntry(req.params.entryId);
    res.json({ success: true, data: { entry } });
  } catch (error) {
    next(error);
  }
};

export const noShow = async (req, res, next) => {
  try {
    const entry = await markNoShow(req.params.entryId);
    res.json({ success: true, data: { entry } });
  } catch (error) {
    next(error);
  }
};
