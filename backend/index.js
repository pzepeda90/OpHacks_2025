/**
 * Punto de entrada principal de la aplicación backend
 */
import cors from "cors";
import express from "express";
import config from "./config/index.js";

// Importar rutas
import scientificQueryRoute from "./routes/scientificQuery.route.js";
import claudeRoute from "./routes/claude.route.js";
import iciteRoute from "./routes/icite.route.js";

// Importar middlewares
import { requestLogger } from "./middlewares/logger.js";
import { errorHandler } from "./middlewares/errorHandler.js";

// Importar Socket.IO y configuración
import { initSocketIO, io } from './socket.js';

// Crear la aplicación Express
const app = express();

// Configuración de middlewares
app.use(express.json({ limit: '2mb' }));
app.use(cors(config.security.corsOptions));
app.use(requestLogger);

// Banner de inicio
console.log('======================================');
console.log('INICIANDO SERVIDOR DE CONSULTAS CIENTÍFICAS');
console.log(`Entorno: ${config.server.env}`);
console.log(`Fecha y hora: ${new Date().toISOString()}`);
console.log('======================================');

// Configuración de rutas
const apiPrefix = config.server.apiPrefix;
app.use(`${apiPrefix}/scientific-query`, scientificQueryRoute);
app.use(`${apiPrefix}/claude`, claudeRoute);
app.use(`${apiPrefix}/icite`, iciteRoute);

// Ruta de prueba para verificar que el servidor está funcionando
app.get("/", (req, res) => {
  res.json({ 
    message: "API de Consultas Científicas con IA funcionando correctamente",
    version: "1.0.0",
    time: new Date().toISOString(),
    socketConnections: io.engine.clientsCount
  });
});

// Middleware para manejar rutas no encontradas
app.use((req, res, next) => {
  res.status(404).json({ 
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` 
  });
});

// Middleware para manejar errores
app.use(errorHandler);

// Configuración del puerto
const PORT = config.server.port;

// Crear el servidor HTTP
import http from 'http';
const server = http.createServer(app);

// Inicializar Socket.IO con el servidor HTTP
const socketIO = initSocketIO(server);

// Iniciar el servidor
server.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
  console.log(`API disponible en http://localhost:${PORT}${apiPrefix}`);
  console.log(`Socket.IO ejecutándose en ws://localhost:${PORT}`);
  console.log('======================================');
});
