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

class PubmedService {
  constructor() {
    // URL base para la API del backend
    this.apiUrl = '/api/scientific-query';
    logInfo('constructor', 'Servicio PubMed inicializado', { apiUrl: this.apiUrl });
  }

  /**
   * Realiza una búsqueda en PubMed usando el backend
   * @param {string} query - Consulta o pregunta clínica
   * @param {string} searchStrategy - Estrategia de búsqueda generada por IA (opcional)
   * @param {boolean} useAI - Indicador de si se debe usar IA para analizar los resultados
   * @param {number} maxResults - Número máximo de resultados a devolver
   * @returns {Promise<Object>} - Resultados de la búsqueda
   */
  async search(query, searchStrategy = "", useAI = false, maxResults = 10) {
    const method = 'search';
    
    if (!query && !searchStrategy) {
      const error = new Error('Se requiere una consulta o estrategia de búsqueda');
      logError(method, error.message);
      throw error;
    }
    
    logInfo(method, `Iniciando búsqueda: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`, { 
      useAI, 
      maxResults,
      hasStrategy: Boolean(searchStrategy) 
    });
    
    try {
      const requestBody = {
        question: query,
        useAI,
        maxResults
      };
      
      // Solo incluir searchStrategy si está definida
      if (searchStrategy) {
        requestBody.searchStrategy = searchStrategy;
      }
      
      const startTime = Date.now();
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
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
        throw new Error(`Error al buscar en PubMed: ${errorMessage}`);
      }
      
      const data = await response.json();
      
      logInfo(method, 'Datos recibidos del backend', { 
        success: data.success !== false, 
        resultCount: data.articles?.length || 0,
        processedQuery: data.searchStrategy || 'No procesada'
      });
      
      // Adaptar la respuesta al formato que espera el frontend
      const adaptedResponse = {
        success: data.success,
        searchStrategy: data.searchStrategy || "",
        results: data.articles || []
      };
      
      // Si hay resultados, mostrar información del primero como ejemplo
      if (adaptedResponse.results && adaptedResponse.results.length > 0) {
        const firstResult = adaptedResponse.results[0];
        logInfo(method, 'Ejemplo del primer resultado:', {
          pmid: firstResult.pmid,
          title: firstResult.title?.substring(0, 100) + (firstResult.title?.length > 100 ? '...' : ''),
          authors: firstResult.authors?.length || 0,
          hasAbstract: Boolean(firstResult.abstract),
          hasAnalysis: Boolean(firstResult.secondaryAnalysis)
        });
      }
      
      return adaptedResponse;
    } catch (error) {
      logError(method, 'Error al realizar búsqueda en PubMed', error);
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