import { Router } from 'express';
import authenticate from '../../middleware/auth.middleware.js';
import { requireRoles } from '../../middleware/role.middleware.js';
import validate from '../../middleware/validate.middleware.js';
import { callNext, complete, getStaffQueue, inService, listStaffQueues, noShow, skip } from '../queues/queue.controller.js';
import { entryIdSchema, queueIdSchema } from '../queues/queue.validation.js';

const router = Router();
const requireStaffOrAdmin = requireRoles('STAFF', 'ADMIN');

router.get('/queues', authenticate, requireStaffOrAdmin, listStaffQueues);
router.get('/queues/:queueId', authenticate, requireStaffOrAdmin, validate(queueIdSchema), getStaffQueue);
router.post('/queues/:queueId/call-next', authenticate, requireStaffOrAdmin, validate(queueIdSchema), callNext);
router.patch('/entries/:entryId/in-service', authenticate, requireStaffOrAdmin, validate(entryIdSchema), inService);
router.patch('/entries/:entryId/complete', authenticate, requireStaffOrAdmin, validate(entryIdSchema), complete);
router.patch('/entries/:entryId/skip', authenticate, requireStaffOrAdmin, validate(entryIdSchema), skip);
router.patch('/entries/:entryId/no-show', authenticate, requireStaffOrAdmin, validate(entryIdSchema), noShow);

export default router;
