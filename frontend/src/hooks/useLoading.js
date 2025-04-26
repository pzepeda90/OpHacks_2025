import { useState, useCallback } from 'react';

/**
 * Hook personalizado para gestionar estados de carga en la aplicación
 * Proporciona funciones para iniciar y detener estados de carga,
 * así como manejo de errores asociados a estas operaciones
 * 
 * @param {boolean} initialState - Estado inicial de carga (por defecto: false)
 * @returns {Object} - Estado de carga, funciones para controlar el estado y función para ejecutar operaciones asíncronas
 */
const useLoading = (initialState = false) => {
  const [isLoading, setIsLoading] = useState(initialState);
  const [error, setError] = useState(null);

  /**
   * Inicia el estado de carga
   */
  const startLoading = useCallback(() => {
    setIsLoading(true);
    setError(null);
  }, []);

  /**
   * Detiene el estado de carga
   */
  const stopLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

  /**
   * Establece un error y detiene el estado de carga
   * @param {Error} err - El error que ocurrió
   */
  const setLoadingError = useCallback((err) => {
    setError(err);
    setIsLoading(false);
  }, []);

  /**
   * Ejecuta una función asíncrona mientras maneja automáticamente
   * los estados de carga y los posibles errores
   * 
   * @param {Function} asyncFn - Función asíncrona a ejecutar
   * @param {Object} options - Opciones adicionales
   * @param {Function} options.onSuccess - Callback a ejecutar en caso de éxito
   * @param {Function} options.onError - Callback adicional en caso de error
   * @returns {Promise<*>} - Resultado de la operación asíncrona
   */
  const withLoading = useCallback(async (asyncFn, options = {}) => {
    const { onSuccess, onError } = options;
    
    try {
      startLoading();
      const result = await asyncFn();
      
      stopLoading();
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      return result;
    } catch (err) {
      setLoadingError(err);
      
      if (onError) {
        onError(err);
      }
      
      return Promise.reject(err);
    }
  }, [startLoading, stopLoading, setLoadingError]);

  return {
    isLoading,
    error,
    startLoading,
    stopLoading,
    setError: setLoadingError,
    withLoading
  };
};

export default useLoading; 