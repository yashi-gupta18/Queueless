import { io } from 'socket.io-client'
import { QUEUE_SOCKET_EVENTS } from '../constants/queueSocketEvents'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api'
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL.replace(/\/api\/?$/, '')

let socket
const joinedQueueRooms = new Map()

const emitJoin = (queueId, callback) => {
  socket?.emit(QUEUE_SOCKET_EVENTS.JOIN_ROOM, { queueId }, callback)
}

export const getSocket = () => {
  if (socket) return socket

  socket = io(SOCKET_URL, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 600,
    reconnectionDelayMax: 5000,
  })

  socket.on('connect', () => {
    joinedQueueRooms.forEach((count, queueId) => {
      if (count > 0) emitJoin(queueId)
    })
  })

  return socket
}

export const connectSocket = () => {
  const activeSocket = getSocket()

  if (!activeSocket.connected) {
    activeSocket.connect()
  }

  return activeSocket
}

export const joinQueueRoom = (queueId, callback) => {
  if (!queueId) return

  const currentCount = joinedQueueRooms.get(queueId) || 0
  joinedQueueRooms.set(queueId, currentCount + 1)
  connectSocket()

  if (currentCount === 0) {
    emitJoin(queueId, callback)
  } else {
    callback?.({ success: true, queueId })
  }
}

export const leaveQueueRoom = (queueId) => {
  if (!queueId || !socket) return

  const currentCount = joinedQueueRooms.get(queueId) || 0

  if (currentCount > 1) {
    joinedQueueRooms.set(queueId, currentCount - 1)
    return
  }

  joinedQueueRooms.delete(queueId)
  socket.emit(QUEUE_SOCKET_EVENTS.LEAVE_ROOM, { queueId })
}

export const onSocketEvent = (eventName, handler) => {
  const activeSocket = connectSocket()
  activeSocket.on(eventName, handler)

  return () => activeSocket.off(eventName, handler)
}

export const disconnectSocket = () => {
  if (!socket) return

  joinedQueueRooms.clear()
  socket.disconnect()
}
