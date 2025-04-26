/**
 * Servicio para interactuar con la API de iCite
 * Permite obtener métricas de impacto para artículos científicos usando PMIDs
 */
import axios from 'axios';
import config from '../config/index.js';

// Funciones para registro de información con timestamp
function logInfo(method, message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [iCite] [${method}] ${message}`);
  if (data) {
    console.log(`[${timestamp}] [iCite] [${method}] Datos:`, 
      typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }
}

function logError(method, message, error = null) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [iCite] [${method}] ERROR: ${message}`);
  if (error) {
    console.error(`[${timestamp}] [iCite] [${method}] Detalles:`, error);
  }
}

class ICiteService {
  constructor() {
    // Base URL para la API de iCite
    this.baseUrl = 'https://icite.od.nih.gov/api';
    
    logInfo('constructor', `Servicio iCite inicializado`);
  }

  /**
   * Obtiene métricas de impacto para un conjunto de PMIDs
   * @param {Array<string>} pmids - Lista de PMIDs para consultar
   * @returns {Promise<Object>} - Resultados con métricas para cada PMID
   */
  async getMetricsForPmids(pmids) {
    const method = 'getMetricsForPmids';
    
    if (!pmids || !Array.isArray(pmids) || pmids.length === 0) {
      const error = new Error('Se requiere un array válido de PMIDs');
      logError(method, error.message);
      throw error;
    }

    logInfo(method, `Obteniendo métricas para ${pmids.length} PMIDs`);
    
    // Limitar a bloques de 200 PMIDs para evitar problemas con la API
    const pmidChunks = [];
    for (let i = 0; i < pmids.length; i += 200) {
      pmidChunks.push(pmids.slice(i, i + 200));
    }
    
    logInfo(method, `Dividido en ${pmidChunks.length} bloques para procesamiento`);
    
    try {
      // Procesar cada bloque y combinar resultados
      let allResults = {};
      
      for (let i = 0; i < pmidChunks.length; i++) {
        const chunk = pmidChunks[i];
        logInfo(method, `Procesando bloque ${i+1}/${pmidChunks.length} (${chunk.length} PMIDs)`);
        
        const url = `${this.baseUrl}/pubs`;
        const params = {
          pmids: chunk.join(','),
          format: 'json'
        };
        
        const startTime = Date.now();
        const response = await axios.get(url, { params });
        const endTime = Date.now();
        
        logInfo(method, `Respuesta recibida para bloque ${i+1} en ${endTime - startTime}ms`);
        
        if (response.data && response.data.data) {
          // La API devuelve un objeto con una propiedad 'data' que contiene un array de resultados
          const chunkResults = response.data.data;
          
          // Convertir array a objeto indexado por PMID para facilitar el acceso
          chunkResults.forEach(item => {
            if (item.pmid) {
              allResults[item.pmid] = this._processMetrics(item);
            }
          });
          
          logInfo(method, `Procesados ${chunkResults.length} resultados del bloque ${i+1}`);
        } else {
          logError(method, `Formato de respuesta inválido para bloque ${i+1}`, response.data);
        }
        
        // Breve pausa entre bloques para no sobrecargar la API
        if (i < pmidChunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      logInfo(method, `Proceso completado. Métricas obtenidas para ${Object.keys(allResults).length} PMIDs`);
      return allResults;
      
    } catch (error) {
      let errorMessage = 'Error al obtener métricas de iCite: ';
      
      if (error.response) {
        errorMessage += `Error ${error.response.status}: ${JSON.stringify(error.response.data)}`;
      } else if (error.request) {
        errorMessage += 'No se recibió respuesta del servidor';
      } else {
        errorMessage += error.message;
      }
      
      logError(method, errorMessage, error);
      throw new Error(errorMessage);
    }
  }
  
  /**
   * Calcula el score de relevancia basado en métricas de iCite
   * @param {Object} metrics - Métricas obtenidas de iCite
   * @returns {number} - Score calculado (0-100)
   */
  calculateRelevanceScore(metrics) {
    const method = 'calculateRelevanceScore';
    
    if (!metrics) {
      logError(method, 'No se proporcionaron métricas para calcular score');
      return 0;
    }
    
    try {
      // Pesos para cada métrica
      const weights = {
        rcr: 0.4,    // Relative Citation Ratio (40%)
        apt: 0.3,    // Approximate Potential to Translate (30%)
        clinical: 0.2, // Clinical Citations (20%)
        citations: 0.1 // Citations (10%)
      };
      
      // Valores por defecto si no existen métricas
      let score = 0;
      
      // Calcular componente de RCR (normalizado para que valores > 1 sean buenos)
      if (metrics.rcr !== undefined && metrics.rcr !== null) {
        // RCR > 1 es mejor que promedio, normalizar a escala 0-10
        const rcrScore = Math.min(metrics.rcr, 10); // Limitar a máximo 10
        score += rcrScore * 10 * weights.rcr; // Multiplicar por 10 para escala 0-100
      }
      
      // Calcular componente de APT
      if (metrics.apt !== undefined && metrics.apt !== null) {
        // APT es una probabilidad (0-1), convertir a escala 0-100
        score += metrics.apt * 100 * weights.apt;
      }
      
      // Calcular componente de citas clínicas
      if (metrics.clinical_citations !== undefined && metrics.clinical_citations !== null) {
        // Normalizar citas clínicas a escala 0-100 (asumiendo que 50+ citas es el máximo)
        const clinicalScore = Math.min(metrics.clinical_citations / 50, 1) * 100;
        score += clinicalScore * weights.clinical;
      }
      
      // Calcular componente de citas totales
      if (metrics.citation_count !== undefined && metrics.citation_count !== null) {
        // Normalizar citas totales a escala 0-100 (asumiendo que 100+ citas es el máximo)
        const citationsScore = Math.min(metrics.citation_count / 100, 1) * 100;
        score += citationsScore * weights.citations;
      }
      
      // Redondear a 2 decimales
      score = Math.round(score * 100) / 100;
      
      logInfo(method, `Score calculado: ${score} basado en métricas:`, metrics);
      return score;
      
    } catch (error) {
      logError(method, 'Error al calcular score de relevancia', error);
      return 0;
    }
  }

  /**
   * Procesa las métricas crudas de iCite en un formato más útil
   * @param {Object} rawMetrics - Métricas sin procesar de la API
   * @returns {Object} - Métricas procesadas
   */
  _processMetrics(rawMetrics) {
    if (!rawMetrics) return null;
    
    // Extraer y normalizar las métricas relevantes
    const processed = {
      pmid: rawMetrics.pmid,
      year: rawMetrics.year,
      title: rawMetrics.title,
      authors: rawMetrics.authors,
      journal: rawMetrics.journal,
      rcr: rawMetrics.relative_citation_ratio || null,
      apt: rawMetrics.nih_percentile || null,
      citation_count: rawMetrics.citation_count || 0,
      clinical_citations: rawMetrics.cited_by_clinical || 0,
      field_citation_rate: rawMetrics.field_citation_rate || null,
      expected_citations: rawMetrics.expected_citations_per_year || null,
      is_clinical: rawMetrics.is_clinical || false,
      provisional: rawMetrics.is_provisional || false
    };
    
    // Calcular score de relevancia
    processed.relevanceScore = this.calculateRelevanceScore(processed);
    
    return processed;
  }
}

export default new ICiteService(); 