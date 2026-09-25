import { Server } from 'socket.io';
import Queue from '../models/queue.model.js';
import { QUEUE_SOCKET_EVENTS } from './socket.events.js';

let ioInstance;

export const getQueueRoom = (queueId) => `queue:${queueId}`;

export const initSocket = (server) => {
  if (ioInstance) {
    return ioInstance;
  }

  ioInstance = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  ioInstance.on('connection', (socket) => {
    socket.on(QUEUE_SOCKET_EVENTS.JOIN_ROOM, async ({ queueId } = {}, callback) => {
      try {
        if (!queueId) {
          throw new Error('Queue id is required');
        }

        const queueExists = await Queue.exists({ _id: queueId });

        if (!queueExists) {
          throw new Error('Queue no longer exists');
        }

        socket.join(getQueueRoom(queueId));
        callback?.({ success: true, queueId });
      } catch (error) {
        const payload = { success: false, message: error.message || 'Unable to join queue room' };
        socket.emit(QUEUE_SOCKET_EVENTS.ERROR, payload);
        callback?.(payload);
      }
    });

    socket.on(QUEUE_SOCKET_EVENTS.LEAVE_ROOM, ({ queueId } = {}, callback) => {
      if (queueId) {
        socket.leave(getQueueRoom(queueId));
      }

      callback?.({ success: true, queueId });
    });
  });

  return ioInstance;
};

export const emitQueueEvent = (eventName, queueId, payload = {}) => {
  if (!ioInstance || !queueId) {
    return;
  }

  const normalizedQueueId = queueId.toString();
  ioInstance.to(getQueueRoom(normalizedQueueId)).emit(eventName, {
    event: eventName,
    queueId: normalizedQueueId,
    emittedAt: new Date().toISOString(),
    ...payload,
  });
};

export const emitQueueUpdated = (queueId, payload = {}) => {
  emitQueueEvent(QUEUE_SOCKET_EVENTS.UPDATED, queueId, payload);
};

