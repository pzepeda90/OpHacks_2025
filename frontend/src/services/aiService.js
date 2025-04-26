import { generateSearchPrompt, generateAnalysisPrompt } from '../utils/aiPrompts';
import axios from 'axios';
import rateLimiter from '../utils/RateLimiter';
import notificationService from './notificationService';

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
      
      // Usar rateLimiter para controlar las solicitudes
      return await rateLimiter.execute(async () => {
        const endpoint = `${this.apiUrl}/strategy`;
        logInfo(methodName, `Enviando solicitud a ${endpoint} (con rate limiting)`);
        
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
          
          // Si es error 429, mostrar mensaje específico
          if (response.status === 429) {
            notificationService.showWarning(
              "Límite de solicitudes alcanzado", 
              "Demasiadas solicitudes a Claude. El sistema ajustará automáticamente la velocidad de las solicitudes. Por favor, espere un momento."
            );
          }
          
          logError(methodName, `Error en respuesta: ${errorMessage}`, { status: response.status });
          throw new Error(`Error en API de Claude: ${errorMessage}`);
        }

        const data = await response.json();
        logInfo(methodName, 'Datos recibidos', { 
          success: data.success, 
          contentLength: data.content ? data.content.length : 0 
        });
        
        return data.content;
      });
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
      logInfo(methodName, `Analizando artículo PMID: ${article.pmid || 'sin PMID'}`);
      
      if (!article || !clinicalQuestion) {
        throw new Error('Se requiere un artículo y una pregunta clínica');
      }

      const prompt = generateAnalysisPrompt(article, clinicalQuestion);
      logInfo(methodName, `Prompt generado, longitud: ${prompt.length} caracteres`);
      
      // Usar rateLimiter para controlar las solicitudes
      return await rateLimiter.execute(async () => {
        const endpoint = `${this.apiUrl}/analyze`;
        logInfo(methodName, `Enviando solicitud a ${endpoint} (con rate limiting)`);
        
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
        logInfo(methodName, 'Datos de análisis recibidos', { 
          success: data.success, 
          contentLength: data.content ? data.content.length : 0 
        });
        
        return data.content;
      });
    } catch (error) {
      logError(methodName, `Error al analizar artículo ${article.pmid || 'sin PMID'}`, error);
      throw error;
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
        
        return await rateLimiter.execute(async () => {
          const startTime = Date.now();
          const response = await fetch(`${this.apiUrl}/analyze-batch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              articles, 
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
        }, { retry: true });
      }

      // Procesamiento individual (fallback o método principal)
      logInfo(methodName, 'Iniciando procesamiento individual de artículos');
      
      // Usar un contador para mostrar notificación de progreso
      let processedCount = 0;
      let totalCount = articles.length;
      
      // Mostrar notificación inicial
      const processNotification = notificationService.showInfo(
        "Procesando artículos", 
        `0 de ${totalCount} artículos procesados. Se aplicarán limitaciones de velocidad para evitar errores.`
      );
      
      // Procesar artículos en secuencia (no en paralelo) para evitar sobrecarga
      const analyzedArticles = [];
      const totalStartTime = Date.now();
      
      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        try {
          logInfo(methodName, `Procesando artículo ${i+1}/${articles.length}: ${article.pmid || 'sin PMID'}`);
          
          // Actualizar notificación
          notificationService.updateText(
            processNotification, 
            `${i} de ${totalCount} artículos procesados. Se aplicarán limitaciones de velocidad para evitar errores.`
          );
          
          const analysis = await this.analyzeArticle(article, clinicalQuestion);
          
          analyzedArticles.push({
            ...article,
            secondaryAnalysis: analysis
          });
          
          processedCount++;
        } catch (error) {
          logError(methodName, `Error en artículo ${i+1}/${articles.length}: ${article.pmid || 'sin PMID'}`, error);
          
          analyzedArticles.push({
            ...article,
            secondaryAnalysis: "No fue posible generar un análisis secundario para este artículo.",
            analysisError: true
          });
        }
      }
      
      // Cerrar notificación
      notificationService.closeNotification(processNotification);
      
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
   * Genera una síntesis de evidencia científica basada en múltiples artículos
   * @param {string} clinicalQuestion - Pregunta clínica
   * @param {Array<Object>} articles - Artículos científicos a sintetizar
   * @returns {Promise<string>} - Síntesis generada
   */
  async generateSynthesis(clinicalQuestion, articles) {
    const methodName = 'generateSynthesis';
    try {
      logInfo(methodName, `Generando síntesis para ${articles.length} artículos`);
      
      if (!clinicalQuestion || !articles || !articles.length) {
        throw new Error('Se requiere una pregunta clínica y artículos para sintetizar');
      }
      
      return await rateLimiter.execute(async () => {
        const endpoint = `${this.apiUrl}/synthesis`;
        logInfo(methodName, `Enviando solicitud a ${endpoint} (con rate limiting)`);
        
        const startTime = Date.now();
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            clinicalQuestion,
            articles
          }),
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
          
          // Si es error 429, mostrar mensaje específico
          if (response.status === 429) {
            notificationService.showWarning(
              "Límite de solicitudes alcanzado", 
              "Demasiadas solicitudes a Claude. La síntesis puede tardar más de lo habitual mientras el sistema se ajusta."
            );
          }
          
          logError(methodName, `Error en respuesta: ${errorMessage}`, { status: response.status });
          throw new Error(`Error en API de Claude: ${errorMessage}`);
        }

        const data = await response.json();
        logInfo(methodName, 'Síntesis recibida', { 
          success: data.success, 
          contentLength: data.content ? data.content.length : 0 
        });
        
        return data.content;
      }, { retry: true });
    } catch (error) {
      logError(methodName, 'Error al generar síntesis', error);
      throw error;
    }
  }
}

export default new AIService(); 