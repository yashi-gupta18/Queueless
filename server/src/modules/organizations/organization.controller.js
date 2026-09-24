import {
  createOrganization,
  deleteOrganization,
  getOrganizationById,
  getOrganizations,
  updateOrganization,
} from './organization.service.js';

export const create = async (req, res, next) => {
  try {
    const organization = await createOrganization(req.body, req.user.id);
    res.status(201).json({ success: true, data: { organization } });
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const organizations = await getOrganizations();
    res.json({ success: true, data: { organizations } });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const organization = await getOrganizationById(req.params.id);
    res.json({ success: true, data: { organization } });
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const organization = await updateOrganization(req.params.id, req.body);
    res.json({ success: true, data: { organization } });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    await deleteOrganization(req.params.id);
    res.json({ success: true, message: 'Organization deleted successfully' });
  } catch (error) {
    next(error);
  }
};
