import {
  createBranch,
  deleteBranch,
  getBranchById,
  getBranches,
  updateBranch,
} from './branch.service.js';

export const create = async (req, res, next) => {
  try {
    const branch = await createBranch(req.body);
    res.status(201).json({ success: true, data: { branch } });
  } catch (error) {
    next(error);
  }
};

export const list = async (req, res, next) => {
  try {
    const branches = await getBranches();
    res.json({ success: true, data: { branches } });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req, res, next) => {
  try {
    const branch = await getBranchById(req.params.id);
    res.json({ success: true, data: { branch } });
  } catch (error) {
    next(error);
  }
};

export const update = async (req, res, next) => {
  try {
    const branch = await updateBranch(req.params.id, req.body);
    res.json({ success: true, data: { branch } });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req, res, next) => {
  try {
    await deleteBranch(req.params.id);
    res.json({ success: true, message: 'Branch deleted successfully' });
  } catch (error) {
    next(error);
  }
};
