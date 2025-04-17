/**
 * Middleware para registrar todas las solicitudes HTTP
 */
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Cuando la respuesta finalice
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
}; 