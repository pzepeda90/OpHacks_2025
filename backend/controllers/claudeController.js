/**
 * Controlador para interactuar con la API de Claude
 * Permite generar estrategias y analizar artículos
 */
import claudeService from '../services/claudeService.js';
import { io } from '../socket.js';

/**
 * Extrae la pregunta clínica de un prompt
 * @param {string} prompt - Prompt que puede contener una pregunta clínica
 * @returns {string} - Pregunta clínica extraída
 */
function extractClinicalQuestion(prompt) {
  // Buscar una pregunta clínica en formato específico
  const match = prompt.match(/Pregunta clínica: (.*?)(\n|$)/);
  return match ? match[1].trim() : prompt;
}

/**
 * Emite un evento de progreso de lote a través de socket.io
 * @param {boolean} processing - Si se está procesando actualmente
 * @param {number} total - Número total de artículos
 * @param {number} current - Número de artículo actual
 */
function emitBatchProgress(processing, total, current) {
  try {
    io.emit('batchProgress', {
      processing,
      total,
      current
    });
    console.log(`Emitido progreso de lote: ${current}/${total}`);
  } catch (error) {
    console.error('Error al emitir progreso de lote:', error);
  }
}

const claudeController = {
  /**
   * Genera una estrategia de búsqueda para PubMed
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  generateStrategy: async (req, res) => {
    try {
      const { prompt } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ 
          success: false,
          message: 'Se requiere un prompt para generar una estrategia'
        });
      }
      
      // Extraer la pregunta clínica del prompt
      const clinicalQuestion = extractClinicalQuestion(prompt);
      
      // Generar estrategia
      const strategyResponse = await claudeService.generateSearchStrategy(clinicalQuestion);
      
      // Devolver la respuesta mejorada con el HTML formateado y los badges
      return res.status(200).json({ 
        success: true,
        content: strategyResponse.enhancedResponse || strategyResponse
      });
    } catch (error) {
      console.error('Error al generar estrategia:', error);
      return res.status(500).json({ 
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  },
  
  /**
   * Analiza un artículo basado en una pregunta clínica
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  analyzeArticle: async (req, res) => {
    try {
      const { prompt, article, clinicalQuestion } = req.body;
      
      // Si recibimos el prompt directamente, lo usamos
      if (prompt) {
        // Extraer información necesaria del prompt
        const extractedQuestion = extractClinicalQuestion(prompt);
        
        // Generar análisis
        const content = await claudeService.generateResponse(prompt);
        
        return res.status(200).json({ 
          success: true,
          content 
        });
      } 
      // Si recibimos el artículo y la pregunta como objetos separados
      else if (article && clinicalQuestion) {
        // Generar análisis
        const content = await claudeService.analyzeArticle(article, clinicalQuestion);
        
        return res.status(200).json({ 
          success: true,
          content 
        });
      } 
      // Si no recibimos ni prompt ni artículo+pregunta
      else {
        return res.status(400).json({ 
          success: false,
          message: 'Se requiere un prompt o un artículo y pregunta clínica'
        });
      }
    } catch (error) {
      console.error('Error en análisis de artículo:', error);
      return res.status(500).json({ 
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  },
  
  /**
   * Analiza múltiples artículos en lote
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  analyzeArticleBatch: async (req, res) => {
    try {
      const { articles, clinicalQuestion } = req.body;
      
      if (!articles || !Array.isArray(articles) || articles.length === 0) {
        return res.status(400).json({ 
          success: false,
          message: 'Se requiere un array de artículos'
        });
      }
      
      if (!clinicalQuestion) {
        return res.status(400).json({ 
          success: false,
          message: 'Se requiere una pregunta clínica'
        });
      }
      
      console.log(`Analizando lote de ${articles.length} artículos`);
      
      // Iniciar emisión de progreso
      emitBatchProgress(true, articles.length, 0);
      
      // Configurar procesamiento por lotes
      const batchSize = 2; // Procesar solo 2 artículos a la vez para evitar rate limiting
      const delayBetweenBatches = 5000; // 5 segundos entre lotes
      const delayBetweenRequests = 3000; // 3 segundos entre solicitudes en el mismo lote
      
      // Función para procesar artículos con retraso
      const processWithDelay = async (article, index) => {
        // Añadir retraso entre solicitudes dentro del mismo lote
        if (index % batchSize !== 0) {
          const delay = delayBetweenRequests + (Math.random() * 2000); // Añadir algo de aleatoriedad
          console.log(`Esperando ${delay/1000} segundos antes de procesar el artículo ${index + 1}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        try {
          console.log(`Procesando artículo ${index + 1}/${articles.length}: "${article.title?.substring(0, 50) || 'Sin título'}..."`);
          
          // Intento inicial
          let analysis;
          try {
            analysis = await claudeService.analyzeArticle(article, clinicalQuestion);
          } catch (initialError) {
            // Si falla por rate limit, reintentamos con un retraso mayor
            if (initialError.message && initialError.message.includes('rate limit')) {
              console.log(`Rate limit alcanzado en artículo ${index + 1}, reintentando después de pausa...`);
              await new Promise(resolve => setTimeout(resolve, 10000)); // 10 segundos
              analysis = await claudeService.analyzeArticle(article, clinicalQuestion);
            } else {
              throw initialError; // Propagar otros errores
            }
          }
          
          // Emitir progreso actualizado
          emitBatchProgress(true, articles.length, index + 1);
          
          return {
            ...article,
            secondaryAnalysis: analysis
          };
        } catch (error) {
          console.error(`Error al analizar artículo ${index + 1}:`, error);
          
          // Emitir progreso actualizado incluso si hay error
          emitBatchProgress(true, articles.length, index + 1);
          
          return {
            ...article,
            secondaryAnalysis: `Error: ${error.message}`,
            error: true
          };
        }
      };
      
      // Procesar artículos en lotes
      const results = [];
      for (let batchStart = 0; batchStart < articles.length; batchStart += batchSize) {
        console.log(`Procesando lote ${Math.floor(batchStart/batchSize) + 1}/${Math.ceil(articles.length/batchSize)}`);
        
        // Procesar un lote
        const batchEnd = Math.min(batchStart + batchSize, articles.length);
        const batchPromises = [];
        
        for (let i = batchStart; i < batchEnd; i++) {
          batchPromises.push(processWithDelay(articles[i], i));
        }
        
        // Esperar a que se complete el lote actual
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Esperar antes de procesar el siguiente lote (excepto el último)
        if (batchEnd < articles.length) {
          // Añadir algo de variabilidad al retraso entre lotes para evitar patrones predecibles
          const batchDelay = delayBetweenBatches + (Math.random() * 3000);
          console.log(`Esperando ${batchDelay/1000} segundos antes del siguiente lote...`);
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      }
      
      // Finalizar emisión de progreso
      emitBatchProgress(false, articles.length, articles.length);
      
      // Contar cuántos análisis fallaron
      const failedCount = results.filter(r => r.error).length;
      const successCount = results.length - failedCount;
      
      return res.status(200).json({
        success: true,
        count: results.length,
        successCount: successCount,
        failedCount: failedCount,
        results
      });
    } catch (error) {
      console.error('Error en análisis por lote:', error);
      
      // Asegurar que se finalice la emisión de progreso en caso de error
      emitBatchProgress(false, 0, 0);
      
      return res.status(500).json({ 
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  },
  
  /**
   * Genera síntesis crítica de la evidencia científica
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  generateSynthesis: async (req, res) => {
    try {
      const { clinicalQuestion, articles } = req.body;
      
      if (!clinicalQuestion) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere una pregunta clínica'
        });
      }
      
      if (!articles || !Array.isArray(articles) || articles.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere un array de artículos con análisis'
        });
      }
      
      // Generar síntesis
      const synthesis = await claudeService.generateSynthesis(clinicalQuestion, articles);
      
      return res.status(200).json({
        success: true,
        synthesis
      });
    } catch (error) {
      console.error('Error al generar síntesis:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  },
  
  /**
   * Filtra artículos basados en la relevancia de sus títulos respecto a una pregunta clínica
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  filterByTitles: async (req, res) => {
    try {
      const { articles, question, limit } = req.body;
      
      if (!articles || !Array.isArray(articles) || articles.length === 0) {
        return res.status(400).json({ 
          success: false,
          message: 'Se requiere un array de artículos válido'
        });
      }
      
      if (!question) {
        return res.status(400).json({ 
          success: false,
          message: 'Se requiere una pregunta clínica'
        });
      }
      
      console.log(`Filtrando ${articles.length} artículos por relevancia de título`);
      
      // Llamar al servicio para filtrar artículos
      const filteredArticles = await claudeService.filterByTitles(articles, question, { 
        limit: limit || 20 
      });
      
      return res.status(200).json({
        success: true,
        count: filteredArticles.length,
        results: filteredArticles
      });
    } catch (error) {
      console.error('Error al filtrar artículos por título:', error);
      return res.status(500).json({ 
        success: false,
        message: error.message || 'Error interno del servidor'
      });
    }
  }
};

export default claudeController; 