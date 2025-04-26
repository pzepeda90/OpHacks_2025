/**
 * Utilidad para manejar limitaciones de tasa (rate limit) a través de
 * exponential backoff, control de concurrencia y cola de solicitudes.
 */
class RateLimiter {
  constructor(options = {}) {
    // Número máximo de solicitudes concurrentes permitidas
    this.maxConcurrent = options.maxConcurrent || 2;
    
    // Tiempo base entre solicitudes en ms (500ms por defecto)
    this.baseDelay = options.baseDelay || 500;
    
    // Tiempo máximo de espera en ms (30 segundos por defecto)
    this.maxDelay = options.maxDelay || 30000;
    
    // Factor de retroceso exponencial (2 por defecto)
    this.backoffFactor = options.backoffFactor || 2;
    
    // Tiempo de recuperación después de un error 429 en ms (60 segundos por defecto)
    this.recoveryTime = options.recoveryTime || 60000;
    
    // Cola de solicitudes pendientes
    this.queue = [];
    
    // Contador de solicitudes activas
    this.activeRequests = 0;
    
    // Último error 429 ocurrido
    this.lastRateLimitHit = 0;
    
    // Retraso actual (aumenta con errores consecutivos)
    this.currentDelay = this.baseDelay;
    
    // Número de errores 429 consecutivos
    this.consecutiveErrors = 0;
    
    // Estado de pausa global
    this.paused = false;
    
    // Debug mode
    this.debug = options.debug || false;
  }

  /**
   * Registra mensajes si el modo debug está activado
   */
  log(message) {
    if (this.debug) {
      console.log(`[RateLimiter] ${message}`);
    }
  }

  /**
   * Pausa todas las solicitudes por un tiempo determinado
   * @param {number} duration - Duración de la pausa en ms
   */
  async pause(duration) {
    this.paused = true;
    this.log(`Sistema pausado por ${duration}ms debido a rate limit`);
    
    await new Promise(resolve => setTimeout(resolve, duration));
    
    this.paused = false;
    this.log('Sistema reanudado después de pausa');
  }

  /**
   * Calcula el retraso actual basado en errores consecutivos
   * @returns {number} - Retraso calculado en ms
   */
  calculateDelay() {
    // Si hubo un 429 reciente, usamos el tiempo de recuperación
    const timeSinceLastRateLimit = Date.now() - this.lastRateLimitHit;
    if (this.lastRateLimitHit > 0 && timeSinceLastRateLimit < this.recoveryTime) {
      const remainingRecoveryTime = this.recoveryTime - timeSinceLastRateLimit;
      this.log(`En periodo de recuperación, ${remainingRecoveryTime}ms restantes`);
      return Math.max(this.currentDelay, remainingRecoveryTime / 2);
    }
    
    // Cálculo de retraso exponencial basado en errores consecutivos
    if (this.consecutiveErrors > 0) {
      return Math.min(
        this.maxDelay,
        this.baseDelay * Math.pow(this.backoffFactor, this.consecutiveErrors)
      );
    }
    
    return this.baseDelay;
  }

  /**
   * Registra un error de rate limit y actualiza los parámetros internos
   */
  registerRateLimitError() {
    this.lastRateLimitHit = Date.now();
    this.consecutiveErrors++;
    this.currentDelay = this.calculateDelay();
    
    this.log(`Error 429 registrado. Errores consecutivos: ${this.consecutiveErrors}. Nuevo retraso: ${this.currentDelay}ms`);
    
    // Si acumulamos demasiados errores, pausamos todo el sistema
    if (this.consecutiveErrors >= 3) {
      const pauseDuration = Math.min(this.recoveryTime * 2, 120000); // Máximo 2 minutos
      this.pause(pauseDuration);
    }
  }

  /**
   * Registra una solicitud exitosa y restablece contadores
   */
  registerSuccess() {
    // Reducimos gradualmente los errores consecutivos con cada éxito
    if (this.consecutiveErrors > 0) {
      this.consecutiveErrors = Math.max(0, this.consecutiveErrors - 1);
      this.currentDelay = this.calculateDelay();
      this.log(`Éxito registrado. Errores consecutivos reducidos a: ${this.consecutiveErrors}`);
    }
  }

  /**
   * Ejecuta una función con control de velocidad
   * @param {Function} fn - Función a ejecutar que devuelve una promesa
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<any>} - Resultado de la función
   */
  async execute(fn, options = {}) {
    return new Promise((resolve, reject) => {
      // Agregamos la tarea a la cola
      this.queue.push({
        fn,
        options,
        resolve,
        reject,
        addedAt: Date.now()
      });
      
      // Intentamos procesar la cola
      this.processQueue();
    });
  }

  /**
   * Procesa la cola de solicitudes
   */
  async processQueue() {
    // Si estamos pausados o ya tenemos el máximo de solicitudes concurrentes, no hacemos nada
    if (this.paused || this.activeRequests >= this.maxConcurrent) {
      return;
    }
    
    // Si no hay elementos en la cola, no hacemos nada
    if (this.queue.length === 0) {
      return;
    }
    
    // Obtenemos el siguiente elemento de la cola y lo procesamos
    const task = this.queue.shift();
    this.activeRequests++;
    
    // Calculamos cuánto tiempo ha estado en la cola
    const queueTime = Date.now() - task.addedAt;
    this.log(`Procesando tarea después de ${queueTime}ms en cola. Solicitudes activas: ${this.activeRequests}`);
    
    // Decidimos si necesitamos esperar antes de ejecutar
    const delay = this.calculateDelay();
    if (delay > 0) {
      this.log(`Esperando ${delay}ms antes de ejecutar la siguiente solicitud`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    try {
      // Ejecutamos la función
      const result = await task.fn();
      
      // Registramos el éxito
      this.registerSuccess();
      
      // Resolvemos la promesa con el resultado
      task.resolve(result);
    } catch (error) {
      // Si es un error de rate limit (429)
      if (error.response && error.response.status === 429) {
        this.log('Error 429 detectado, ajustando parámetros');
        this.registerRateLimitError();
        
        // Volvemos a poner la tarea en la cola al principio si se especifica reintentar
        if (task.options.retry !== false) {
          this.log('Reintentando tarea después del error 429');
          this.queue.unshift({
            ...task,
            addedAt: Date.now() // Actualizamos el tiempo
          });
        } else {
          task.reject(error);
        }
      } else {
        // Para otros errores, simplemente los propagamos
        task.reject(error);
      }
    } finally {
      // Decrementamos el contador de solicitudes activas
      this.activeRequests--;
      
      // Continuamos procesando la cola
      this.processQueue();
    }
  }
}

// Exportamos una instancia global predeterminada
const defaultRateLimiter = new RateLimiter({
  maxConcurrent: 2,
  baseDelay: 1000,
  maxDelay: 60000,
  recoveryTime: 90000,
  debug: true
});

export default defaultRateLimiter;
export { RateLimiter }; 