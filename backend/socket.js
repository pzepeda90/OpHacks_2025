/**
 * Configuración de Socket.IO para comunicación en tiempo real
 */
import { Server } from 'socket.io';
import http from 'http';

// Variable para almacenar la instancia de Socket.IO
let io;

/**
 * Inicializa Socket.IO con un servidor HTTP
 * @param {http.Server} server - Servidor HTTP de Express
 * @returns {Server} - Instancia de Socket.IO
 */
export const initSocketIO = (server) => {
  io = new Server(server, {
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization']
    },
    allowEIO3: true, // Permitir compatibilidad con versiones anteriores
    transports: ['polling', 'websocket'],
    pingTimeout: 30000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e8 // 100 MB
  });

  io.on('connection', (socket) => {
    console.log(`Cliente Socket.IO conectado: ${socket.id}`);
    
    // Enviar un mensaje de confirmación al cliente
    socket.emit('welcome', { message: 'Conexión establecida correctamente con el servidor Socket.IO' });
    
    socket.on('disconnect', (reason) => {
      console.log(`Cliente Socket.IO desconectado (${socket.id}): ${reason}`);
    });
    
    socket.on('error', (error) => {
      console.error(`Error en socket ${socket.id}:`, error);
    });
  });

  console.log('Socket.IO inicializado correctamente');
  return io;
};

/**
 * Obtiene la instancia de Socket.IO
 * @returns {Server} - Instancia de Socket.IO
 */
export const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO no ha sido inicializado. Llamar a initSocketIO primero.');
  }
  return io;
};

// Exportar la variable io que será inicializada más tarde
export { io };

export default {
  initSocketIO,
  getIO,
  io
}; 