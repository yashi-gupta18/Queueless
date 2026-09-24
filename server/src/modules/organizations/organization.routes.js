import { Router } from 'express';
import authenticate from '../../middleware/auth.middleware.js';
import { requireAdmin } from '../../middleware/role.middleware.js';
import validate from '../../middleware/validate.middleware.js';
import { create, getById, list, remove, update } from './organization.controller.js';
import {
  createOrganizationSchema,
  organizationIdSchema,
  updateOrganizationSchema,
} from './organization.validation.js';

const router = Router();

router.post('/', authenticate, requireAdmin, validate(createOrganizationSchema), create);
router.get('/', authenticate, list);
router.get('/:id', authenticate, validate(organizationIdSchema), getById);
router.patch('/:id', authenticate, requireAdmin, validate(updateOrganizationSchema), update);
router.delete('/:id', authenticate, requireAdmin, validate(organizationIdSchema), remove);

export default router;
