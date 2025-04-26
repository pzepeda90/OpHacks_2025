/**
 * Utilidad para manejar errores de forma centralizada en la aplicación,
 * especialmente los errores de rate limit (429) y otros errores comunes.
 */
import notificationService from '../services/notificationService';

/**
 * Configuración para el contador de errores
 */
const errorConfig = {
  // Tipos de errores a monitorear
  trackedErrors: {
    'rate-limit': { // Error 429 - Too Many Requests
      count: 0,
      lastOccurrence: null,
      threshold: 3, // Mostrar advertencia después de 3 errores
      cooldown: 60000, // 1 minuto de cooldown entre notificaciones
      message: 'Se están generando demasiadas solicitudes a Claude. El sistema está ajustando automáticamente la velocidad para evitar bloqueos. Por favor, espere un momento antes de realizar más consultas.'
    },
    'network': { // Errores de red
      count: 0,
      lastOccurrence: null,
      threshold: 2,
      cooldown: 120000, // 2 minutos
      message: 'Se están experimentando problemas de conexión. Por favor, verifique su conexión a internet.'
    },
    'timeout': { // Errores de timeout
      count: 0,
      lastOccurrence: null,
      threshold: 2,
      cooldown: 120000, // 2 minutos
      message: 'Las solicitudes están tardando demasiado tiempo. El servidor podría estar sobrecargado. Por favor, intente nuevamente más tarde.'
    }
  },
  // Notificación activa actual
  activeNotification: null
};

/**
 * Registra un error y muestra una notificación si es necesario
 * @param {string} type - Tipo de error ('rate-limit', 'network', 'timeout')
 * @param {Error} error - Objeto de error original
 */
const trackError = (type, error) => {
  // Verificar si es un tipo de error que monitoreamos
  if (!errorConfig.trackedErrors[type]) {
    console.warn(`Tipo de error no reconocido: ${type}`);
    return;
  }

  const errorType = errorConfig.trackedErrors[type];
  const now = Date.now();
  
  // Incrementar contador
  errorType.count++;
  errorType.lastOccurrence = now;
  
  console.warn(`[Error Tracker] Error tipo ${type} registrado. Contador: ${errorType.count}`);
  
  // Si ya alcanzamos el umbral y ha pasado suficiente tiempo desde la última notificación
  if (errorType.count >= errorType.threshold) {
    // Verificar si hay notificación activa
    if (!errorConfig.activeNotification) {
      // Mostrar notificación
      errorConfig.activeNotification = notificationService.showWarning(
        'Advertencia del sistema',
        errorType.message
      );
      
      // Resetear contador
      errorType.count = 0;
      
      // Liberar la notificación después del cooldown
      setTimeout(() => {
        errorConfig.activeNotification = null;
      }, errorType.cooldown);
    }
  }
};

/**
 * Manejador global de errores para manejar errores de fetch y axios
 * @param {Error} error - Error capturado
 * @returns {Error} - El mismo error para permitir propagación
 */
const handleApiError = (error) => {
  // Analizar el tipo de error
  if (error.response) {
    // La petición fue realizada y el servidor respondió con un código de error
    const status = error.response.status;
    
    if (status === 429) {
      trackError('rate-limit', error);
    } else if (status >= 500) {
      trackError('server', error);
    }
  } else if (error.request) {
    // La petición fue realizada pero no se recibió respuesta
    if (error.code === 'ECONNABORTED') {
      trackError('timeout', error);
    } else {
      trackError('network', error);
    }
  }
  
  // Re-lanzar el error para manejo adicional
  return error;
};

/**
 * Configura manejadores globales de errores
 */
const setupGlobalErrorHandlers = () => {
  // Interceptar errores no capturados
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    handleApiError(error);
  });
  
  // Patch global fetch para capturar errores
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    try {
      const response = await originalFetch(...args);
      
      // Capturar errores 429 específicamente
      if (response.status === 429) {
        trackError('rate-limit', new Error('Rate limit exceeded'));
      }
      
      return response;
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  };
  
  console.log('[Error Handler] Manejadores globales de errores configurados');
};

// Exportar funciones útiles
export { handleApiError, trackError, setupGlobalErrorHandlers };

// Exportar por defecto el setup
export default setupGlobalErrorHandlers; 