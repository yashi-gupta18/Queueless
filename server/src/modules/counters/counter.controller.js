import { createCounter, deleteCounter, getCounters, updateCounter } from './counter.service.js';

export const create = async (req, res, next) => {
  try {
    const counter = await createCounter(req.body);
    res.status(201).json({ success: true, data: { counter } });
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const counters = await getCounters();
    res.json({ success: true, data: { counters } });
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const counter = await updateCounter(req.params.id, req.body);
    res.json({ success: true, data: { counter } });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    await deleteCounter(req.params.id);
    res.json({ success: true, message: 'Counter deleted successfully' });
  } catch (error) {
    next(error);
  }
};
