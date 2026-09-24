import {
  createService,
  deleteService,
  getServiceById,
  getServices,
  updateService,
} from './service.service.js';

export const create = async (req, res, next) => {
  try {
    const service = await createService(req.body);
    res.status(201).json({ success: true, data: { service } });
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const services = await getServices();
    res.json({ success: true, data: { services } });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const service = await getServiceById(req.params.id);
    res.json({ success: true, data: { service } });
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const service = await updateService(req.params.id, req.body);
    res.json({ success: true, data: { service } });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    await deleteService(req.params.id);
    res.json({ success: true, message: 'Service deleted successfully' });
  } catch (error) {
    next(error);
  }
};
