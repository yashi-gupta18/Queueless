export const QUEUE_SOCKET_EVENTS = Object.freeze({
  JOIN_ROOM: 'queue:join',
  LEAVE_ROOM: 'queue:leave-room',
  ERROR: 'queue:error',
  JOINED: 'queue:joined',
  LEFT: 'queue:left',
  CALLED: 'queue:called',
  SERVICE_STARTED: 'queue:service-started',
  COMPLETED: 'queue:completed',
  SKIPPED: 'queue:skipped',
  NO_SHOW: 'queue:no-show',
  OPENED: 'queue:opened',
  CLOSED: 'queue:closed',
  UPDATED: 'queue:updated',
});

export const QUEUE_REALTIME_EVENTS = [
  QUEUE_SOCKET_EVENTS.JOINED,
  QUEUE_SOCKET_EVENTS.LEFT,
  QUEUE_SOCKET_EVENTS.CALLED,
  QUEUE_SOCKET_EVENTS.SERVICE_STARTED,
  QUEUE_SOCKET_EVENTS.COMPLETED,
  QUEUE_SOCKET_EVENTS.SKIPPED,
  QUEUE_SOCKET_EVENTS.NO_SHOW,
  QUEUE_SOCKET_EVENTS.OPENED,
  QUEUE_SOCKET_EVENTS.CLOSED,
  QUEUE_SOCKET_EVENTS.UPDATED,
];

