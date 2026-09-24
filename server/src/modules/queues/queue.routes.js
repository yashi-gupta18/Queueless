import { Router } from 'express';
import authenticate from '../../middleware/auth.middleware.js';
import { requireCustomer } from '../../middleware/role.middleware.js';
import validate from '../../middleware/validate.middleware.js';
import { join, leave, list, myPosition, status } from './queue.controller.js';
import { listQueuesSchema, queueIdSchema } from './queue.validation.js';

const router = Router();

router.get('/', authenticate, validate(listQueuesSchema), list);
router.post('/:queueId/join', authenticate, requireCustomer, validate(queueIdSchema), join);
router.delete('/:queueId/leave', authenticate, requireCustomer, validate(queueIdSchema), leave);
router.get('/:queueId/status', authenticate, validate(queueIdSchema), status);
router.get('/:queueId/my-position', authenticate, requireCustomer, validate(queueIdSchema), myPosition);

export default router;
