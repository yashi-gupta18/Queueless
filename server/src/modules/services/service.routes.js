import { Router } from 'express';
import authenticate from '../../middleware/auth.middleware.js';
import { requireAdmin } from '../../middleware/role.middleware.js';
import validate from '../../middleware/validate.middleware.js';
import { create, getById, list, remove, update } from './service.controller.js';
import { createServiceSchema, serviceIdSchema, updateServiceSchema } from './service.validation.js';

const router = Router();

router.post('/', authenticate, requireAdmin, validate(createServiceSchema), create);
router.get('/', authenticate, list);
router.get('/:id', authenticate, validate(serviceIdSchema), getById);
router.patch('/:id', authenticate, requireAdmin, validate(updateServiceSchema), update);
router.delete('/:id', authenticate, requireAdmin, validate(serviceIdSchema), remove);

export default router;
