'use client';

import { io, Socket } from 'socket.io-client';
import { API_URL } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, {
      auth: { mode: 'dashboard' },
      withCredentials: true,
      autoConnect: true,
    });
  }
  return socket;
}
