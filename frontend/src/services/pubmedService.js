/**
 * Servicio para interactuar con PubMed a través del backend
 */

// Función para logs detallados
const logInfo = (method, message, data) => {
  const timestamp = new Date().toISOString();
  console.log(`[PUBMED ${timestamp}] [${method}] ${message}`);
  if (data) console.log(data);
};

const logError = (method, message, error) => {
  const timestamp = new Date().toISOString();
  console.error(`[PUBMED ERROR ${timestamp}] [${method}] ${message}`);
  if (error) {
    console.error('Mensaje de error:', error.message);
    if (error.response) {
      console.error('Estado:', error.response.status);
      console.error('Datos:', error.response.data);
    }
  }
};

// Función para loguear objetos
const logObject = (data) => {
  if (data) console.log(data);
};

class PubmedService {
  constructor() {
    // URL base para la API del backend
    this.apiUrl = '/api/scientific-query';
    logInfo('constructor', 'Servicio PubMed inicializado', { apiUrl: this.apiUrl });
  }

  /**
   * Busca artículos en PubMed
   * @param {string} query - Consulta o pregunta clínica
   * @param {string|object} strategy - Estrategia de búsqueda (puede ser string u objeto)
   * @param {boolean} useAI - Indicador de si se usa IA para procesar la consulta
   * @param {number} maxResults - Número máximo de resultados a retornar
   * @returns {Promise<Object>} - Resultados de la búsqueda
   */
  async search(query, strategy, useAI = false, maxResults = 10) {
    const methodName = 'search';
    try {
      logInfo(methodName, `Iniciando búsqueda: "${query}"`);
      logObject({ useAI, maxResults, hasStrategy: !!strategy });
      
      // Preparar la estrategia para enviarla al backend
      let searchStrategy = '';
      if (strategy) {
        if (typeof strategy === 'object') {
          // Si es un objeto, podemos usar .strategy (la estrategia estructurada) o .fullResponse
          searchStrategy = strategy.strategy || strategy.fullResponse || '';
        } else {
          // Si es una string, la usamos directamente
          searchStrategy = strategy;
        }
      }
      
      // Endpoint de búsqueda
      const endpoint = '/api/scientific-query';
      
      // Datos para la solicitud
      const requestData = {
        question: query,
        strategy: searchStrategy,
        useAI: useAI
      };
      
      const startTime = Date.now();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
      const endTime = Date.now();
      
      logInfo(methodName, `Respuesta recibida en ${endTime - startTime}ms, status: ${response.status}`);
      
      if (!response.ok) {
        let errorMessage = 'Error desconocido';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || response.statusText;
        } catch (e) {
          errorMessage = response.statusText;
        }
        
        logError(methodName, `Error en respuesta: ${errorMessage}`);
        throw new Error(`Error al buscar en PubMed: ${errorMessage}`);
      }
      
      const data = await response.json();
      logInfo(methodName, 'Datos recibidos del backend');
      logObject(data);
      
      // Si la búsqueda fue exitosa pero no hay resultados, retornar lista vacía
      if (data.success && (!data.articles || data.articles.length === 0)) {
        return {
          success: true,
          message: data.message || 'No se encontraron artículos para la consulta',
          results: []
        };
      }
      
      // Si hay datos pero tienen un formato inesperado
      if (!data.articles) {
        logError(methodName, 'Formato de respuesta inesperado', data);
        throw new Error('Formato de respuesta inválido del servidor');
      }
      
      // Procesar y retornar resultados
      return {
        success: true,
        message: data.message || 'Búsqueda completada exitosamente',
        results: data.articles,
        searchStrategy: data.searchStrategy,
        fullResponseStrategy: data.fullResponseStrategy
      };
    } catch (error) {
      logError(methodName, 'Error al realizar búsqueda en PubMed');
      logError(methodName, error.message);
      throw error;
    }
  }

  /**
   * Obtiene los detalles de un artículo específico por su PMID
   * @param {string} pmid - Identificador de PubMed
   * @returns {Promise<Object>} - Detalles del artículo
   */
  async getArticleById(pmid) {
    const method = 'getArticleById';
    
    if (!pmid) {
      const error = new Error('Se requiere un PMID válido');
      logError(method, error.message);
      throw error;
    }
    
    logInfo(method, `Obteniendo artículo con PMID: ${pmid}`);
    
    try {
      const startTime = Date.now();
      
      const response = await fetch(`${this.apiUrl}/article/${pmid}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const endTime = Date.now();
      logInfo(method, `Respuesta recibida en ${endTime - startTime}ms, status: ${response.status}`);
      
      if (!response.ok) {
        let errorMessage = 'Error desconocido';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || response.statusText;
        } catch (e) {
          errorMessage = response.statusText;
        }
        
        logError(method, `Error en respuesta: ${errorMessage}`, { status: response.status });
        throw new Error(`Error al obtener artículo de PubMed: ${errorMessage}`);
      }
      
      const data = await response.json();
      
      logInfo(method, 'Artículo recibido', { 
        success: data.success !== false,
        pmid: data.result?.pmid,
        title: data.result?.title?.substring(0, 100) + (data.result?.title?.length > 100 ? '...' : '')
      });
      
      return data.result;
    } catch (error) {
      logError(method, `Error al obtener artículo con PMID: ${pmid}`, error);
      throw error;
    }
  }
}

export default new PubmedService(); 