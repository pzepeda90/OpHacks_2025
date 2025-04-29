import { generateSearchPrompt, generateAnalysisPrompt } from '../utils/aiPrompts';
import axios from 'axios';

// Función para logs detallados
const logInfo = (method, message, data) => {
  const timestamp = new Date().toISOString();
  console.log(`[CLAUDE API ${timestamp}] [${method}] ${message}`);
  if (data) console.log(data);
};

const logError = (method, message, error) => {
  const timestamp = new Date().toISOString();
  console.error(`[CLAUDE ERROR ${timestamp}] [${method}] ${message}`);
  if (error) {
    console.error('Mensaje de error:', error.message);
    if (error.response) {
      console.error('Estado:', error.response.status);
      console.error('Datos:', error.response.data);
    }
  }
};

/**
 * Servicio para interactuar con la API de Claude
 */
class AIService {
  constructor() {
    // URL base para la API de Claude (proxy a través del backend)
    this.apiUrl = '/api/claude';
    logInfo('Constructor', 'Servicio de Claude inicializado', { apiUrl: this.apiUrl });
  }

  /**
   * Genera una estrategia de búsqueda optimizada para PubMed utilizando Claude
   * @param {string} clinicalQuestion - Pregunta clínica del usuario
   * @returns {Promise<string>} - Estrategia de búsqueda generada
   */
  async generateSearchStrategy(clinicalQuestion) {
    const methodName = 'generateSearchStrategy';
    try {
      logInfo(methodName, `Generando estrategia para: "${clinicalQuestion.substring(0, 50)}..."`);
      
      if (!clinicalQuestion) {
        throw new Error('Se requiere una pregunta clínica');
      }

      const prompt = generateSearchPrompt(clinicalQuestion);
      logInfo(methodName, `Prompt generado, longitud: ${prompt.length} caracteres`);
      
      const endpoint = `${this.apiUrl}/strategy`;
      logInfo(methodName, `Enviando solicitud a ${endpoint}`);
      
      const startTime = Date.now();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });
      const endTime = Date.now();
      
      logInfo(methodName, `Respuesta recibida en ${endTime - startTime}ms, status: ${response.status}`);
      
      if (!response.ok) {
        let errorMessage = 'Error desconocido';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || response.statusText;
        } catch (e) {
          errorMessage = response.statusText;
        }
        
        logError(methodName, `Error en respuesta: ${errorMessage}`, { status: response.status });
        throw new Error(`Error en API de Claude: ${errorMessage}`);
      }

      const data = await response.json();
      logInfo(methodName, 'Datos recibidos', { 
        success: data.success, 
        contentLength: data.content ? data.content.length : 0 
      });
      
      // Ahora manejamos la posibilidad de que content sea un objeto con strategy y fullResponse
      let result = data.content;
      
      // Si es un objeto con structure {strategy, fullResponse}
      if (result && typeof result === 'object' && (result.strategy || result.fullResponse)) {
        logInfo(methodName, 'Respuesta recibida en nuevo formato (objeto)', {
          hasStrategy: !!result.strategy,
          hasFullResponse: !!result.fullResponse
        });
        // Devolvemos el objeto completo para que el frontend pueda usar ambas partes
        return result;
      }
      
      // Compatibilidad con el formato anterior (string)
      return result;
    } catch (error) {
      logError(methodName, 'Error al generar estrategia de búsqueda', error);
      throw error;
    }
  }

  /**
   * Analiza un artículo científico en relación a una pregunta clínica utilizando Claude
   * @param {Object} article - Artículo científico a analizar
   * @param {string} clinicalQuestion - Pregunta clínica del usuario
   * @returns {Promise<string>} - Análisis del artículo
   */
  async analyzeArticle(article, clinicalQuestion) {
    const methodName = 'analyzeArticle';
    try {
      logInfo(methodName, `Analizando artículo: ${article.pmid || 'sin PMID'}`);
      
      if (!article || !clinicalQuestion) {
        throw new Error('Se requieren artículo y pregunta clínica');
      }

      // Validar y normalizar la propiedad authors
      const processedArticle = {...article};
      if (!processedArticle.authors) {
        processedArticle.authors = [];
      } else if (!Array.isArray(processedArticle.authors)) {
        // Si authors existe pero no es un array, convertirlo a array
        if (typeof processedArticle.authors === 'string') {
          // Si es una cadena, crear un array con un solo elemento
          processedArticle.authors = [{ name: processedArticle.authors }];
        } else {
          // Si es otro tipo, crear un array vacío
          processedArticle.authors = [];
        }
      }
      
      const startTime = Date.now();
      logInfo(methodName, 'Enviando solicitud al servidor');
      
      const response = await fetch(`${this.apiUrl}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          article: processedArticle, 
          clinicalQuestion 
        }),
      });
      
      const endTime = Date.now();
      logInfo(methodName, `Respuesta recibida en ${endTime - startTime}ms, status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error en la solicitud: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      // Mejorado: Verificación más detallada de la respuesta para manejar diferentes estructuras de datos
      if (!data.success) {
        throw new Error(`El servidor indicó un error: ${data.message || 'Error desconocido'}`);
      }
      
      // Verificar si la respuesta tiene la estructura esperada
      if (data.analysis) {
        logInfo(methodName, 'Análisis completado con éxito (formato estándar)');
        return data.analysis;
      } else if (data.content) {
        // Formato alternativo que puede estar usando el backend
        logInfo(methodName, 'Análisis completado con éxito (formato alternativo)');
        return data.content;
      } else {
        // Si no encontramos el análisis en ningún formato conocido
        logInfo(methodName, 'Respuesta recibida pero sin contenido de análisis', data);
        
        // Verificar si hay algún otro campo que podría contener el análisis
        const possibleFields = ['result', 'secondaryAnalysis', 'text', 'html'];
        for (const field of possibleFields) {
          if (data[field] && typeof data[field] === 'string' && data[field].length > 0) {
            logInfo(methodName, `Usando campo alternativo "${field}" para el análisis`);
            return data[field];
          }
        }
        
        // Si no podemos encontrar el análisis, crear una respuesta de error formateada
        return `<div class="card-analysis">
          <div class="card-header">
            <h3>ANÁLISIS DE EVIDENCIA</h3>
            <div class="badges">
              <span class="badge quality">★☆☆☆☆</span>
              <span class="badge type">Error</span>
            </div>
          </div>
          <div class="card-section">
            <h4>ERROR DE ANÁLISIS</h4>
            <p>No fue posible analizar este artículo. Error: Formato de respuesta inválido</p>
          </div>
        </div>`;
      }
    } catch (error) {
      logError(methodName, 'Error en análisis de artículo', error);
      
      // Devolver un mensaje de error formateado como HTML para que se muestre correctamente
      return `<div class="card-analysis">
        <div class="card-header">
          <h3>ANÁLISIS DE EVIDENCIA</h3>
          <div class="badges">
            <span class="badge quality">★☆☆☆☆</span>
            <span class="badge type">Error</span>
          </div>
        </div>
        <div class="card-section">
          <h4>ERROR DE ANÁLISIS</h4>
          <p>No fue posible analizar este artículo. Error: ${error.message || 'Desconocido'}</p>
        </div>
      </div>`;
    }
  }

  /**
   * Analiza un lote de artículos en relación a una pregunta clínica
   * @param {Array<Object>} articles - Artículos científicos a analizar
   * @param {string} clinicalQuestion - Pregunta clínica del usuario
   * @returns {Promise<Array<Object>>} - Artículos con análisis incluido
   */
  async analyzeArticleBatch(articles, clinicalQuestion) {
    const methodName = 'analyzeArticleBatch';
    try {
      logInfo(methodName, `Analizando lote de ${articles.length} artículos`);
      
      if (!articles || !articles.length || !clinicalQuestion) {
        throw new Error('Se requieren artículos y una pregunta clínica');
      }

      // Validar y normalizar la propiedad authors para cada artículo
      const validatedArticles = articles.map(article => {
        const processedArticle = {...article};
        
        // Verificar y corregir la propiedad authors si es necesario
        if (!processedArticle.authors) {
          processedArticle.authors = [];
        } else if (!Array.isArray(processedArticle.authors)) {
          // Si authors existe pero no es un array, convertirlo a array
          if (typeof processedArticle.authors === 'string') {
            // Si es una cadena, crear un array con un solo elemento
            processedArticle.authors = [{ name: processedArticle.authors }];
          } else {
            // Si es otro tipo, crear un array vacío
            processedArticle.authors = [];
          }
        }
        
        return processedArticle;
      });

      // Comprobar API endpoint para lotes
      let useBatchEndpoint = false;
      try {
        const batchEndpoint = `${this.apiUrl}/analyze-batch`;
        logInfo(methodName, `Comprobando si existe endpoint de lotes: ${batchEndpoint}`);
        
        // Podríamos intentar primero usar el endpoint de lotes si existe
        const response = await fetch(batchEndpoint, {
          method: 'HEAD'
        });
        
        if (response.ok || response.status === 405) { // 405 = Method Not Allowed, indica que el endpoint existe
          useBatchEndpoint = true;
          logInfo(methodName, 'Endpoint de lotes disponible, se usará procesamiento por lotes');
        }
      } catch (error) {
        logInfo(methodName, 'No se pudo verificar endpoint de lotes, usando procesamiento individual');
      }
      
      if (useBatchEndpoint) {
        // Procesamiento por lotes (si está disponible)
        logInfo(methodName, 'Enviando lote completo al servidor');
        
        const startTime = Date.now();
        const response = await fetch(`${this.apiUrl}/analyze-batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            articles: validatedArticles, 
            clinicalQuestion 
          }),
        });
        const endTime = Date.now();
        
        logInfo(methodName, `Respuesta de lote recibida en ${endTime - startTime}ms, status: ${response.status}`);
        
        if (!response.ok) {
          logInfo(methodName, 'Procesamiento por lotes falló, cambiando a procesamiento individual');
          // Si falla, volvemos al procesamiento individual
        } else {
          const data = await response.json();
          if (data.success && data.results) {
            logInfo(methodName, `Análisis por lotes completado con éxito, ${data.results.length} artículos procesados`);
            return data.results;
          } else {
            logInfo(methodName, 'Formato inválido en respuesta por lotes, cambiando a procesamiento individual');
          }
        }
      }

      // Procesamiento individual (fallback o método principal)
      logInfo(methodName, 'Iniciando procesamiento individual de artículos');
      
      // Procesar artículos en paralelo con Promise.all
      const totalStartTime = Date.now();
      const analyzedArticles = await Promise.all(
        validatedArticles.map(async (article, index) => {
          try {
            logInfo(methodName, `Procesando artículo ${index+1}/${validatedArticles.length}: ${article.pmid || 'sin PMID'}`);
            
            // Intento de análisis usando el método mejorado que maneja errores internamente
            const analysis = await this.analyzeArticle(article, clinicalQuestion);
            
            // Verificar si el análisis contiene indicación de error
            const isErrorAnalysis = typeof analysis === 'string' && 
                                   (analysis.includes('<span class="badge type">Error</span>') || 
                                    analysis.includes('ERROR DE ANÁLISIS'));
            
            if (isErrorAnalysis) {
              logError(methodName, `Error detectado en análisis de artículo ${index+1}/${validatedArticles.length}: ${article.pmid || 'sin PMID'}`);
              return {
                ...article,
                secondaryAnalysis: analysis,
                analysisError: true  // Marcar como error para la UI
              };
            }
            
            return {
              ...article,
              secondaryAnalysis: analysis
            };
          } catch (error) {
            logError(methodName, `Error en artículo ${index+1}/${validatedArticles.length}: ${article.pmid || 'sin PMID'}`, error);
            
            // Crear un mensaje de error formateado como HTML
            const errorAnalysis = `<div class="card-analysis">
              <div class="card-header">
                <h3>ANÁLISIS DE EVIDENCIA</h3>
                <div class="badges">
                  <span class="badge quality">★☆☆☆☆</span>
                  <span class="badge type">Error</span>
                </div>
              </div>
              <div class="card-section">
                <h4>ERROR DE ANÁLISIS</h4>
                <p>No fue posible analizar este artículo. Error: ${error.message || 'Desconocido'}</p>
              </div>
            </div>`;
            
            return {
              ...article,
              secondaryAnalysis: errorAnalysis,
              analysisError: true
            };
          }
        })
      );
      const totalEndTime = Date.now();

      logInfo(methodName, `Análisis de lote completado en ${totalEndTime - totalStartTime}ms`);
      const successCount = analyzedArticles.filter(a => !a.analysisError).length;
      const errorCount = analyzedArticles.filter(a => a.analysisError).length;
      logInfo(methodName, `Resultados: ${successCount} éxitos, ${errorCount} errores`);
      
      return analyzedArticles;
    } catch (error) {
      logError(methodName, 'Error general en análisis por lotes', error);
      throw error;
    }
  }

  /**
   * Genera una síntesis crítica de la evidencia científica
   * @param {string} clinicalQuestion - Pregunta clínica
   * @param {Array} articles - Lista de artículos con su análisis
   * @returns {Promise<string>} - Texto HTML con la síntesis
   */
  async generateSynthesis(clinicalQuestion, articles) {
    const methodName = 'generateSynthesis';
    try {
      logInfo(methodName, `Generando síntesis para: "${clinicalQuestion.substring(0, 50)}..." con ${articles.length} artículos`);
      
      const endpoint = `${this.apiUrl}/synthesis`;
      logInfo(methodName, `Enviando solicitud a ${endpoint}`);
      
      const requestData = {
        clinicalQuestion,
        articles
      };
      
      const startTime = Date.now();
      const response = await axios.post(endpoint, requestData);
      const endTime = Date.now();
      
      logInfo(methodName, `Respuesta recibida en ${endTime - startTime}ms, status: ${response.status}`);
      
      // Verificar si la respuesta contiene el campo synthesis
      if (response.data && response.data.success && response.data.synthesis) {
        logInfo(methodName, `Síntesis generada exitosamente, longitud: ${response.data.synthesis.length} caracteres`);
        return response.data.synthesis;
      } else {
        logError(methodName, 'La respuesta no contiene una síntesis válida', response.data);
        throw new Error('No se recibió una síntesis válida del servidor');
      }
    } catch (error) {
      logError(methodName, 'Error al generar síntesis', error);
      
      // Estructurar mejor el mensaje de error
      let errorMessage = 'Error al generar la síntesis';
      
      if (error.response) {
        errorMessage += `: ${error.response.data.message || error.response.data.error || 'Error del servidor'}`;
      } else if (error.request) {
        errorMessage += ': No se pudo conectar con el servidor';
      } else {
        errorMessage += `: ${error.message}`;
      }
      
      throw new Error(errorMessage);
    }
  }
}

export default new AIService(); 