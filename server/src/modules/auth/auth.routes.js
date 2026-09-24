import { Router } from 'express';
import { login, logout, me, register } from './auth.controller.js';
import authenticate from '../../middleware/auth.middleware.js';
import validate from '../../middleware/validate.middleware.js';
import { loginSchema, registerSchema } from './auth.validation.js';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', authenticate, me);
router.post('/logout', authenticate, logout);

export default router;
