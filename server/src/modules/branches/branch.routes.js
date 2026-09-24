import { Router } from 'express';
import authenticate from '../../middleware/auth.middleware.js';
import { requireAdmin } from '../../middleware/role.middleware.js';
import validate from '../../middleware/validate.middleware.js';
import { create, getById, list, remove, update } from './branch.controller.js';
import { branchIdSchema, createBranchSchema, updateBranchSchema } from './branch.validation.js';

const router = Router();

router.post('/', authenticate, requireAdmin, validate(createBranchSchema), create);
router.get('/', authenticate, list);
router.get('/:id', authenticate, validate(branchIdSchema), getById);
router.patch('/:id', authenticate, requireAdmin, validate(updateBranchSchema), update);
router.delete('/:id', authenticate, requireAdmin, validate(branchIdSchema), remove);

export default router;
