/**
 * Middleware para manejo centralizado de errores
 * Proporciona un formato consistente para todos los errores de la aplicación
 */

/**
 * Middleware que captura y procesa todos los errores de la aplicación
 * @param {Error} err - Objeto de error
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función para continuar a siguiente middleware
 */
export const errorHandler = (err, req, res, next) => {
  console.error('ERROR CAPTURADO POR MIDDLEWARE:', err);
  
  // Determinar código de estado según el tipo de error
  let statusCode = err.statusCode || 500;
  
  // Para errores específicos de validación (por ejemplo, Joi)
  if (err.name === 'ValidationError') {
    statusCode = 400;
  }
  
  // Para errores de base de datos
  if (err.code && err.code.toString().startsWith('23')) { // PostgreSQL
    statusCode = 400;
  }
  
  // Formato de respuesta estándar para errores
  const errorResponse = {
    success: false,
    error: {
      message: err.message || 'Error interno del servidor',
      type: err.name || 'Error',
      code: err.code || 'UNKNOWN_ERROR'
    }
  };
  
  // En desarrollo, incluir la pila de error
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
    
    // Si hay detalles adicionales específicos del error
    if (err.details) {
      errorResponse.error.details = err.details;
    }
  }
  
  // Si estamos en producción, algunos errores pueden tener mensajes demasiado
  // técnicos o revelar información sensible, así que los sanitizamos
  if (process.env.NODE_ENV === 'production') {
    // Errores 500 generalmente no deben exponer detalles internos
    if (statusCode === 500) {
      errorResponse.error.message = 'Error interno del servidor';
    }
  }
  
  // Registrar el error para análisis
  console.error(`[${new Date().toISOString()}] ${statusCode} ERROR:`, {
    method: req.method,
    url: req.originalUrl,
    error: errorResponse
  });
  
  // Enviar respuesta al cliente
  res.status(statusCode).json(errorResponse);
};

/**
 * Función para crear errores personalizados con información adicional
 * @param {string} message - Mensaje de error
 * @param {number} statusCode - Código de estado HTTP
 * @param {string} code - Código de error personalizado
 * @returns {Error} - Error con información adicional
 */
export const createError = (message, statusCode = 500, code = 'SERVER_ERROR') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

// Expone funciones auxiliares para manejar tipos de errores comunes
export const errorTypes = {
  badRequest: (message = 'Solicitud inválida', code = 'BAD_REQUEST') => 
    createError(message, 400, code),
    
  unauthorized: (message = 'No autorizado', code = 'UNAUTHORIZED') => 
    createError(message, 401, code),
    
  forbidden: (message = 'Acceso prohibido', code = 'FORBIDDEN') => 
    createError(message, 403, code),
    
  notFound: (message = 'Recurso no encontrado', code = 'NOT_FOUND') => 
    createError(message, 404, code),
    
  conflict: (message = 'Conflicto con el estado actual', code = 'CONFLICT') => 
    createError(message, 409, code),
    
  tooManyRequests: (message = 'Demasiadas solicitudes', code = 'TOO_MANY_REQUESTS') => 
    createError(message, 429, code),
    
  serverError: (message = 'Error interno del servidor', code = 'SERVER_ERROR') => 
    createError(message, 500, code)
}; 