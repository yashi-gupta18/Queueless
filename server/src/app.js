import cors from 'cors';
import express from 'express';
import authRoutes from './modules/auth/auth.routes.js';
import branchRoutes from './modules/branches/branch.routes.js';
import counterRoutes from './modules/counters/counter.routes.js';
import organizationRoutes from './modules/organizations/organization.routes.js';
import queueRoutes from './modules/queues/queue.routes.js';
import serviceRoutes from './modules/services/service.routes.js';
import staffQueueRoutes from './modules/staffQueue/staffQueue.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

const app = express();
const corsOrigin = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'QueueLess API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/counters', counterRoutes);
app.use('/api/queues', queueRoutes);
app.use('/api/staff', staffQueueRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
