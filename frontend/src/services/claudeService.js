/**
 * Servicio para interactuar con la API de Claude desde el frontend
 */
import api from './api';

class ClaudeService {
  /**
   * Genera una estrategia de búsqueda para PubMed
   * @param {string} clinicalQuestion - Pregunta clínica
   * @returns {Promise<string>} - Estrategia de búsqueda para PubMed
   */
  async generateSearchStrategy(clinicalQuestion) {
    try {
      console.log('Generando estrategia de búsqueda para:', clinicalQuestion);
      
      const response = await api.post('/claude/generate-strategy', {
        prompt: clinicalQuestion
      });
      
      if (response.data && response.data.success && response.data.content) {
        console.log('Estrategia generada con éxito');
        return response.data.content;
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
    } catch (error) {
      console.error('Error al generar estrategia de búsqueda:', error);
      throw error;
    }
  }
  
  /**
   * Analiza un artículo científico
   * @param {Object} article - Artículo a analizar
   * @param {string} clinicalQuestion - Pregunta clínica
   * @returns {Promise<string>} - Análisis del artículo
   */
  async analyzeArticle(article, clinicalQuestion) {
    try {
      console.log('Analizando artículo:', article.title);
      
      const response = await api.post('/claude/analyze-article', {
        article,
        clinicalQuestion
      });
      
      if (response.data && response.data.success && response.data.content) {
        console.log('Artículo analizado con éxito');
        return response.data.content;
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
    } catch (error) {
      console.error('Error al analizar artículo:', error);
      throw error;
    }
  }
  
  /**
   * Analiza un lote de artículos científicos
   * @param {Array<Object>} articles - Artículos a analizar
   * @param {string} clinicalQuestion - Pregunta clínica
   * @param {Function} onProgress - Función opcional para notificar progreso
   * @returns {Promise<Object>} - Resultados del análisis
   */
  async analyzeArticleBatch(articles, clinicalQuestion, onProgress) {
    try {
      console.log(`Analizando lote de ${articles.length} artículos`);
      
      if (onProgress) {
        onProgress({
          processing: true,
          total: articles.length,
          current: 0
        });
      }
      
      const response = await api.post('/claude/analyze-article-batch', {
        articles,
        clinicalQuestion
      }, {
        timeout: 300000 // 5 minutos de timeout para lotes grandes
      });
      
      if (response.data && response.data.success) {
        console.log(`Análisis de lote completado: ${response.data.successCount} exitosos, ${response.data.failedCount} fallidos`);
        
        if (onProgress) {
          onProgress({
            processing: false,
            total: articles.length,
            current: articles.length
          });
        }
        
        return response.data;
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
    } catch (error) {
      console.error('Error al analizar lote de artículos:', error);
      
      if (onProgress) {
        onProgress({
          processing: false,
          total: 0,
          current: 0,
          error: true
        });
      }
      
      throw error;
    }
  }
}

export default new ClaudeService(); 