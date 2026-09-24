import { Router } from 'express';
import authenticate from '../../middleware/auth.middleware.js';
import { requireAdmin } from '../../middleware/role.middleware.js';
import validate from '../../middleware/validate.middleware.js';
import { create, list, remove, update } from './counter.controller.js';
import { counterIdSchema, createCounterSchema, updateCounterSchema } from './counter.validation.js';

const router = Router();

router.post('/', authenticate, requireAdmin, validate(createCounterSchema), create);
router.get('/', authenticate, list);
router.patch('/:id', authenticate, requireAdmin, validate(updateCounterSchema), update);
router.delete('/:id', authenticate, requireAdmin, validate(counterIdSchema), remove);

export default router;
