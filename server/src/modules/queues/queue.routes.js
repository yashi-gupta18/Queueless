import { Router } from 'express';
import authenticate from '../../middleware/auth.middleware.js';
import { requireAdmin, requireCustomer } from '../../middleware/role.middleware.js';
import validate from '../../middleware/validate.middleware.js';
import { close, create, getById, join, leave, list, myActiveEntry, myPosition, open, remove, status } from './queue.controller.js';
import { createQueueSchema, listQueuesSchema, queueByIdSchema, queueIdSchema } from './queue.validation.js';

const router = Router();

router.post('/', authenticate, requireAdmin, validate(createQueueSchema), create);
router.get('/', authenticate, validate(listQueuesSchema), list);
router.get('/my-active', authenticate, requireCustomer, myActiveEntry);
router.get('/:id', authenticate, validate(queueByIdSchema), getById);
router.patch('/:id/open', authenticate, requireAdmin, validate(queueByIdSchema), open);
router.patch('/:id/close', authenticate, requireAdmin, validate(queueByIdSchema), close);
router.delete('/:id', authenticate, requireAdmin, validate(queueByIdSchema), remove);
router.post('/:queueId/join', authenticate, requireCustomer, validate(queueIdSchema), join);
router.delete('/:queueId/leave', authenticate, requireCustomer, validate(queueIdSchema), leave);
router.get('/:queueId/status', authenticate, validate(queueIdSchema), status);
router.get('/:queueId/my-position', authenticate, requireCustomer, validate(queueIdSchema), myPosition);

export default router;
