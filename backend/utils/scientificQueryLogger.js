/**
 * Servicio de logging especializado para el proceso de búsqueda científica
 * Proporciona un seguimiento coherente del flujo completo de procesamiento
 */

const LOG_PREFIX = 'SCIENTIFIC-QUERY';

/**
 * Genera un ID único para identificar un proceso de consulta
 * @returns {string} - ID único de proceso
 */
const generateQueryId = () => {
  const timestamp = Date.now();
  const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `QRY-${timestamp}-${randomPart}`;
};

/**
 * Registra el inicio de un proceso de consulta científica
 * @param {string} question - Pregunta clínica original
 * @param {boolean} useAI - Indicador de uso de IA
 * @returns {string} - ID del proceso iniciado
 */
const startProcess = (question, useAI) => {
  const queryId = generateQueryId();
  const timestamp = new Date().toISOString();
  
  console.log(`[${timestamp}] [${LOG_PREFIX}] [${queryId}] === INICIO DE PROCESO DE CONSULTA CIENTÍFICA ===`);
  console.log(`[${timestamp}] [${LOG_PREFIX}] [${queryId}] Pregunta: "${question}"`);
  console.log(`[${timestamp}] [${LOG_PREFIX}] [${queryId}] Uso de IA: ${useAI ? 'ACTIVADO' : 'DESACTIVADO'}`);
  console.log(`[${timestamp}] [${LOG_PREFIX}] [${queryId}] --------------------------------------`);
  
  return queryId;
};

/**
 * Registra información sobre una fase del proceso
 * @param {string} queryId - ID del proceso de consulta
 * @param {string} phase - Nombre de la fase
 * @param {string} message - Mensaje a registrar
 * @param {Object} data - Datos adicionales (opcional)
 */
const phaseInfo = (queryId, phase, message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${LOG_PREFIX}] [${queryId}] [${phase}] ${message}`);
  
  if (data) {
    if (typeof data === 'string') {
      // Si es una cadena muy larga, truncarla
      if (data.length > 500) {
        console.log(`[${timestamp}] [${LOG_PREFIX}] [${queryId}] [${phase}] Datos: ${data.substring(0, 500)}...`);
      } else {
        console.log(`[${timestamp}] [${LOG_PREFIX}] [${queryId}] [${phase}] Datos: ${data}`);
      }
    } else {
      // Si es un objeto, convertirlo a JSON con formato
      try {
        const serialized = JSON.stringify(data, null, 2);
        console.log(`[${timestamp}] [${LOG_PREFIX}] [${queryId}] [${phase}] Datos: ${serialized}`);
      } catch (e) {
        console.log(`[${timestamp}] [${LOG_PREFIX}] [${queryId}] [${phase}] Datos: [Objeto no serializable]`);
      }
    }
  }
};

/**
 * Registra un error en una fase del proceso
 * @param {string} queryId - ID del proceso de consulta
 * @param {string} phase - Nombre de la fase
 * @param {string} message - Mensaje de error
 * @param {Error} error - Objeto de error (opcional)
 */
const phaseError = (queryId, phase, message, error = null) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [${LOG_PREFIX}] [${queryId}] [${phase}] ERROR: ${message}`);
  
  if (error) {
    console.error(`[${timestamp}] [${LOG_PREFIX}] [${queryId}] [${phase}] Mensaje: ${error.message}`);
    console.error(`[${timestamp}] [${LOG_PREFIX}] [${queryId}] [${phase}] Stack: ${error.stack}`);
    
    if (error.response) {
      console.error(`[${timestamp}] [${LOG_PREFIX}] [${queryId}] [${phase}] Estado: ${error.response.status}`);
      console.error(`[${timestamp}] [${LOG_PREFIX}] [${queryId}] [${phase}] Datos: ${JSON.stringify(error.response.data || {})}`);
    }
  }
};

/**
 * Registra una métrica de tiempo para una fase
 * @param {string} queryId - ID del proceso de consulta
 * @param {string} phase - Nombre de la fase
 * @param {number} startTime - Tiempo de inicio (ms)
 * @param {number} endTime - Tiempo de fin (ms)
 */
const phaseTime = (queryId, phase, startTime, endTime) => {
  const duration = endTime - startTime;
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${LOG_PREFIX}] [${queryId}] [${phase}] Duración: ${duration}ms`);
};

/**
 * Registra el final de un proceso de consulta científica
 * @param {string} queryId - ID del proceso de consulta
 * @param {boolean} success - Indicador de éxito
 * @param {number} resultCount - Número de resultados (opcional)
 */
const endProcess = (queryId, success, resultCount = null) => {
  const timestamp = new Date().toISOString();
  
  console.log(`[${timestamp}] [${LOG_PREFIX}] [${queryId}] --------------------------------------`);
  console.log(`[${timestamp}] [${LOG_PREFIX}] [${queryId}] === FIN DE PROCESO DE CONSULTA CIENTÍFICA ===`);
  console.log(`[${timestamp}] [${LOG_PREFIX}] [${queryId}] Estado: ${success ? 'EXITOSO' : 'FALLIDO'}`);
  
  if (resultCount !== null) {
    console.log(`[${timestamp}] [${LOG_PREFIX}] [${queryId}] Resultados encontrados: ${resultCount}`);
  }
  
  console.log(`[${timestamp}] [${LOG_PREFIX}] [${queryId}] ======================================`);
};

export default {
  startProcess,
  phaseInfo,
  phaseError,
  phaseTime,
  endProcess
}; 