import dotenv from 'dotenv';
import http from 'http';
import app from './app.js';
import connectDB from './config/db.js';
import { initSocket } from './socket/socket.service.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

await connectDB();

const server = http.createServer(app);

initSocket(server);

server.listen(PORT, () => {
  console.log(`QueueLess API listening on port ${PORT}`);
});
