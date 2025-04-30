/**
 * Test de integración Frontend-Backend
 * Verifica que los datos enviados desde el frontend sean procesados correctamente
 * y que las respuestas del backend tengan el formato esperado por el frontend
 */
import { jest } from '@jest/globals';
import axios from 'axios';
import AIService from '../../frontend/src/services/aiService';

// Mock global fetch para simular la interacción entre frontend y backend
global.fetch = jest.fn();

// Crear instancia del servicio AI del frontend
const aiService = new AIService();

// Silenciar logs durante las pruebas
console.log = jest.fn();
console.error = jest.fn();

describe('Integración de datos Frontend-Backend', () => {
  beforeEach(() => {
    // Limpiar todos los mocks
    jest.clearAllMocks();
    
    // Configurar fetch para devolver respuestas por defecto
    global.fetch.mockImplementation(async (url, options) => {
      // Analizar la URL y opciones para determinar la respuesta adecuada
      if (url.includes('/analyze')) {
        // Simular una respuesta de análisis de artículo
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            analysis: `<div class="card-analysis">
              <div class="card-header">
                <h3>ANÁLISIS DE EVIDENCIA</h3>
                <div class="badges">
                  <span class="badge quality">★★★★☆</span>
                </div>
              </div>
              <div class="card-section">
                <h4>RESUMEN CLÍNICO</h4>
                <p>Respuesta de prueba.</p>
              </div>
            </div>`
          })
        };
      } else if (url.includes('/analyze-batch')) {
        // Simular una respuesta de análisis por lotes
        const body = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            results: body.articles.map(article => ({
              ...article,
              secondaryAnalysis: `<div class="card-analysis">Análisis de ${article.pmid}</div>`,
              analyzed: true
            }))
          })
        };
      } else if (url.includes('/strategy')) {
        // Simular una respuesta de estrategia de búsqueda
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            content: {
              strategy: '("Test"[Mesh] AND "Data"[tiab])',
              fullResponse: 'Respuesta completa de Claude',
              enhancedResponse: '<div>HTML formateado</div>',
              metrics: {
                sensibilidad: 85,
                precision: 70
              }
            }
          })
        };
      } else if (url.includes('/synthesis')) {
        // Simular una respuesta de síntesis
        return {
          ok: true, 
          status: 200,
          json: async () => ({
            success: true,
            synthesis: '<div class="synthesis">Síntesis de la evidencia</div>'
          })
        };
      } else if (options.method === 'HEAD') {
        // Para las verificaciones de endpoint
        return {
          ok: true,
          status: 200
        };
      }
      
      // Para cualquier otra solicitud
      return {
        ok: false,
        status: 404,
        json: async () => ({ success: false, error: 'Endpoint no encontrado' })
      };
    });
  });
  
  describe('Análisis de artículo', () => {
    test('procesa correctamente la respuesta del backend', async () => {
      // Datos de prueba
      const articleData = {
        pmid: '12345678',
        title: 'Título de prueba',
        abstract: 'Resumen de prueba',
        authors: [{ name: 'Autor de Prueba' }],
        publicationDate: '2023-01-01'
      };
      const clinicalQuestion = '¿Es efectivo el tratamiento X para la condición Y?';
      
      // Llamar al método del frontend
      const analysisResult = await aiService.analyzeArticle(articleData, clinicalQuestion);
      
      // Verificar que fetch se llamó con los parámetros correctos
      expect(global.fetch).toHaveBeenCalledWith('/api/claude/analyze', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        }),
        body: expect.any(String)
      }));
      
      // Verificar que los datos enviados son correctos
      const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(requestBody).toEqual({
        article: articleData,
        clinicalQuestion
      });
      
      // Verificar el formato de la respuesta
      expect(analysisResult).toContain('<div class="card-analysis">');
      expect(analysisResult).toContain('<span class="badge quality">');
      expect(analysisResult).toContain('<h4>RESUMEN CLÍNICO</h4>');
    });
    
    test('maneja correctamente errores del backend', async () => {
      // Configurar fetch para simular un error
      global.fetch.mockImplementationOnce(async () => ({
        ok: false,
        status: 500,
        text: async () => 'Error interno del servidor'
      }));
      
      // Datos de prueba
      const articleData = {
        pmid: '12345678',
        title: 'Título de prueba',
        abstract: 'Resumen de prueba'
      };
      const clinicalQuestion = '¿Es efectivo el tratamiento X para la condición Y?';
      
      // La llamada debe lanzar un error
      await expect(aiService.analyzeArticle(articleData, clinicalQuestion))
        .rejects.toThrow('Error en la solicitud: 500');
    });
    
    test('normaliza correctamente la propiedad authors', async () => {
      // Datos de prueba con authors como string
      const articleData = {
        pmid: '12345678',
        title: 'Título de prueba',
        abstract: 'Resumen de prueba',
        authors: 'Autor1, Autor2' // String en lugar de array
      };
      const clinicalQuestion = '¿Es efectivo el tratamiento X para la condición Y?';
      
      // Llamar al método
      await aiService.analyzeArticle(articleData, clinicalQuestion);
      
      // Verificar que se normalizó el campo authors
      const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(Array.isArray(requestBody.article.authors)).toBe(true);
      expect(requestBody.article.authors).toEqual([{ name: 'Autor1, Autor2' }]);
    });
  });
  
  describe('Análisis por lotes', () => {
    test('utiliza el endpoint de lotes cuando está disponible', async () => {
      // Datos de prueba
      const articles = [
        {
          pmid: '1111',
          title: 'Artículo 1',
          abstract: 'Resumen 1'
        },
        {
          pmid: '2222',
          title: 'Artículo 2',
          abstract: 'Resumen 2'
        }
      ];
      const clinicalQuestion = '¿Es efectivo el tratamiento X para la condición Y?';
      
      // Llamar al método
      const results = await aiService.analyzeArticleBatch(articles, clinicalQuestion);
      
      // Verificar que se usó el endpoint de lotes
      expect(global.fetch).toHaveBeenCalledWith('/api/claude/analyze-batch', expect.anything());
      
      // Verificar la estructura de los resultados
      expect(results.length).toBe(2);
      expect(results[0]).toHaveProperty('pmid', '1111');
      expect(results[0]).toHaveProperty('secondaryAnalysis');
      expect(results[0].secondaryAnalysis).toContain(`<div class="card-analysis">Análisis de 1111</div>`);
    });
    
    test('procesa artículos individualmente si falla el endpoint de lotes', async () => {
      // Configurar fetch para simular un error en el endpoint de lotes
      global.fetch.mockImplementationOnce(async (url) => {
        if (url.includes('/analyze-batch')) {
          return { ok: false, status: 500 };
        }
      });
      
      // Datos de prueba
      const articles = [
        {
          pmid: '1111',
          title: 'Artículo 1',
          abstract: 'Resumen 1'
        }
      ];
      const clinicalQuestion = '¿Es efectivo el tratamiento X para la condición Y?';
      
      // Llamar al método
      await aiService.analyzeArticleBatch(articles, clinicalQuestion);
      
      // Verificar que se usó el endpoint individual como fallback
      expect(global.fetch).toHaveBeenCalledWith('/api/claude/analyze', expect.anything());
    });
  });
  
  describe('Generación de estrategia de búsqueda', () => {
    test('procesa correctamente el formato de estrategia devuelto por el backend', async () => {
      // Llamar al método del frontend
      const result = await aiService.generateSearchStrategy('¿Cuál es la efectividad de X para Y?');
      
      // Verificar estructura del resultado
      expect(result).toHaveProperty('strategy');
      expect(result).toHaveProperty('fullResponse');
      expect(result).toHaveProperty('enhancedResponse');
      expect(result).toHaveProperty('metrics');
      
      // Verificar valores específicos
      expect(result.strategy).toBe('("Test"[Mesh] AND "Data"[tiab])');
      expect(result.metrics).toHaveProperty('sensibilidad', 85);
    });
  });
}); 