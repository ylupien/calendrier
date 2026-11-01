import { io } from 'socket.io-client';

let socket;

export function getSocket() {
  if (!socket) socket = io({ path: '/socket.io', withCredentials: true });
  return socket;
}

/** Reconnects after the visitor got their cookie (the first handshake was refused without one). */
export function ensureConnected() {
  const s = getSocket();
  if (!s.connected && !s.active) s.connect();
}
