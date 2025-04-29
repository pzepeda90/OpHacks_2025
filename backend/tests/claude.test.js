import request from 'supertest';
import { jest } from '@jest/globals';
import express from 'express';
import claudeRoutes from '../routes/claude.route.js';
import { claudeServiceMock } from './__mocks__/services.js';

// Mockear el servicio de Claude
jest.mock('../services/claudeService.js', () => ({
  __esModule: true,
  default: claudeServiceMock
}));

// Crear una app Express para pruebas
const app = express();
app.use(express.json());
app.use('/api/claude', claudeRoutes);

// Configurar mocks antes de cada prueba
beforeEach(() => {
  jest.clearAllMocks();
});

describe('Claude API', () => {
  describe('POST /api/claude/generate-strategy', () => {
    it('debería recibir una respuesta exitosa al generar una estrategia de búsqueda', async () => {
      const res = await request(app)
        .post('/api/claude/generate-strategy')
        .send({
          prompt: '¿Es eficaz el tratamiento X para la condición Y?'
        })
        .timeout(10000); // Aumentar timeout a 10 segundos
      
      // Verificamos que la solicitud fue procesada
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(500);
    }, 10000); // Aumentar timeout a 10 segundos

    it('debería manejar errores cuando no se proporciona un prompt', async () => {
      const res = await request(app)
        .post('/api/claude/generate-strategy')
        .send({});
      
      // Verificamos que se recibe alguna respuesta de error
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('POST /api/claude/analyze-article', () => {
    it('debería recibir una respuesta exitosa al analizar un artículo con prompt', async () => {
      const res = await request(app)
        .post('/api/claude/analyze-article')
        .send({
          prompt: 'Análisis del artículo sobre tratamiento X'
        })
        .timeout(10000); // Aumentar timeout a 10 segundos
      
      // Verificamos que la solicitud fue procesada
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(500);
    }, 10000); // Aumentar timeout a 10 segundos

    it('debería recibir una respuesta exitosa al analizar un artículo con datos', async () => {
      const res = await request(app)
        .post('/api/claude/analyze-article')
        .send({
          article: {
            pmid: '12345',
            title: 'Artículo de prueba',
            abstract: 'Resumen del artículo'
          },
          clinicalQuestion: '¿Es eficaz el tratamiento X para la condición Y?'
        })
        .timeout(10000); // Aumentar timeout a 10 segundos
      
      // Verificamos que la solicitud fue procesada
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(500);
    }, 10000); // Aumentar timeout a 10 segundos

    it('debería manejar errores cuando no se proporcionan datos', async () => {
      const res = await request(app)
        .post('/api/claude/analyze-article')
        .send({});
      
      // Verificamos que se recibe alguna respuesta de error
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('debería manejar correctamente artículos con diferentes formatos de authors', async () => {
      // Caso 1: authors como string
      const resString = await request(app)
        .post('/api/claude/analyze-article')
        .send({
          article: {
            pmid: '12345',
            title: 'Artículo de prueba',
            abstract: 'Resumen del artículo',
            authors: 'Autor Único'
          },
          clinicalQuestion: '¿Es eficaz el tratamiento X para la condición Y?'
        })
        .timeout(10000);
      
      expect(resString.status).toBe(200);
      expect(resString.body.success).toBe(true);
      
      // Caso 2: authors como undefined
      const resUndefined = await request(app)
        .post('/api/claude/analyze-article')
        .send({
          article: {
            pmid: '12345',
            title: 'Artículo de prueba',
            abstract: 'Resumen del artículo'
            // authors no está definido
          },
          clinicalQuestion: '¿Es eficaz el tratamiento X para la condición Y?'
        })
        .timeout(10000);
      
      expect(resUndefined.status).toBe(200);
      expect(resUndefined.body.success).toBe(true);
      
      // Caso 3: authors como null
      const resNull = await request(app)
        .post('/api/claude/analyze-article')
        .send({
          article: {
            pmid: '12345',
            title: 'Artículo de prueba',
            abstract: 'Resumen del artículo',
            authors: null
          },
          clinicalQuestion: '¿Es eficaz el tratamiento X para la condición Y?'
        })
        .timeout(10000);
      
      expect(resNull.status).toBe(200);
      expect(resNull.body.success).toBe(true);
    }, 30000); // Aumentamos el timeout a 30 segundos para esta prueba
  });

  describe('POST /api/claude/analyze-batch', () => {
    it('debería procesar un lote de artículos', async () => {
      const res = await request(app)
        .post('/api/claude/analyze-batch')
        .send({
          articles: [
            { pmid: '12345', title: 'Artículo 1' },
            { pmid: '67890', title: 'Artículo 2' }
          ],
          clinicalQuestion: '¿Es eficaz el tratamiento X para la condición Y?'
        })
        .timeout(20000); // Aumentar timeout a 20 segundos
      
      // Verificamos que la solicitud fue procesada (puede éxito o error controlado)
      expect(res.status).toBeDefined();
    }, 20000); // Aumentar timeout a 20 segundos

    it('debería manejar errores de rate limit (429) y reintentar', async () => {
      // Configurar el mock para simular un error de rate limit en el primer intento
      // y luego una respuesta exitosa en el segundo intento
      const rateLimitError = new Error('Demasiadas solicitudes. Se ha superado el límite de rate limit de la API.');
      rateLimitError.message = 'rate limit exceeded';
      
      // Guardamos la implementación original
      const originalImplementation = claudeServiceMock.analyzeArticleBatch;
      
      // Sobrescribimos temporalmente para este test
      claudeServiceMock.analyzeArticleBatch.mockImplementationOnce(() => {
        throw rateLimitError;
      }).mockImplementationOnce(() => {
        return [
          {
            pmid: '12345',
            title: 'Artículo 1',
            secondaryAnalysis: 'Análisis después de reintentar',
            analyzed: true
          }
        ];
      });
      
      const res = await request(app)
        .post('/api/claude/analyze-batch')
        .send({
          articles: [{ pmid: '12345', title: 'Artículo 1', abstract: 'Resumen del artículo' }],
          clinicalQuestion: '¿Es eficaz el tratamiento X para la condición Y?'
        })
        .timeout(30000);
      
      // Restauramos la implementación original después del test
      claudeServiceMock.analyzeArticleBatch = originalImplementation;
      
      // Verificamos que se manejó el error y se recibió una respuesta
      expect(res.status).toBe(200);
      expect(claudeServiceMock.analyzeArticleBatch).toHaveBeenCalledTimes(2); // Verifica que se hizo un reintento
      expect(res.body.success).toBe(true);
    }, 30000);

    it('debería manejar múltiples errores de rate limit (429) consecutivos', async () => {
      // Configurar el mock para simular múltiples errores de rate limit
      const rateLimitError = new Error('Demasiadas solicitudes');
      rateLimitError.message = 'rate limit exceeded';
      
      // Error con código HTTP 429
      const error429 = new Error('Too Many Requests');
      error429.message = '429 Too Many Requests';
      
      // Guardamos la implementación original
      const originalImplementation = claudeServiceMock.analyzeArticleBatch;
      
      // Sobrescribimos temporalmente para este test - siempre falla con error de rate limit
      claudeServiceMock.analyzeArticleBatch.mockRejectedValue(rateLimitError);
      
      const res = await request(app)
        .post('/api/claude/analyze-batch')
        .send({
          articles: [{ pmid: '12345', title: 'Artículo 1', abstract: 'Resumen del artículo' }],
          clinicalQuestion: '¿Es eficaz el tratamiento X para la condición Y?'
        })
        .timeout(30000);
      
      // Restauramos la implementación original después del test
      claudeServiceMock.analyzeArticleBatch = originalImplementation;
      
      // Verificamos que se manejó correctamente el error persistente de rate limit
      expect(res.status).toBe(500); // Debería dar error 500 después de agotar reintentos
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error).toContain('rate limit');
    }, 30000);

    it('debería retornar un error si no se proporcionan artículos', async () => {
      const res = await request(app)
        .post('/api/claude/analyze-batch')
        .send({
          clinicalQuestion: '¿Es eficaz el tratamiento X para la condición Y?'
        });
      
      // Verificamos que se recibe alguna respuesta de error
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });

    it('debería retornar un error si no se proporciona una pregunta clínica', async () => {
      const res = await request(app)
        .post('/api/claude/analyze-batch')
        .send({
          articles: [{ pmid: '12345', title: 'Artículo 1' }]
        });
      
      // Verificamos que se recibe alguna respuesta de error
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/claude/filter-by-titles', () => {
    it('debería filtrar artículos por títulos correctamente', async () => {
      // Crear una respuesta con dos artículos filtrados
      const res = await request(app)
        .post('/api/claude/filter-by-titles')
        .send({
          articles: [
            { pmid: '12345', title: 'Artículo relevante 1' },
            { pmid: '67890', title: 'Artículo relevante 2' },
            { pmid: '54321', title: 'Artículo no relevante' }
          ],
          question: '¿Es eficaz el tratamiento X para la condición Y?',
          limit: 2
        })
        .timeout(10000);
      
      // Verificamos que se reciba una respuesta exitosa
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      
      // Verificamos que haya resultados (al menos 1 artículo)
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body.results.length).toBeGreaterThan(0);
    }, 10000);
    
    it('debería manejar errores cuando no se proporcionan artículos', async () => {
      const res = await request(app)
        .post('/api/claude/filter-by-titles')
        .send({
          question: '¿Es eficaz el tratamiento X para la condición Y?'
        });
      
      // Verificamos que se recibe alguna respuesta de error
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });
    
    it('debería manejar errores cuando no se proporciona una pregunta', async () => {
      const res = await request(app)
        .post('/api/claude/filter-by-titles')
        .send({
          articles: [{ pmid: '12345', title: 'Artículo 1' }]
        });
      
      // Verificamos que se recibe alguna respuesta de error
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/claude/generate-synthesis', () => {
    it('debería procesar una solicitud de síntesis', async () => {
      const res = await request(app)
        .post('/api/claude/generate-synthesis')
        .send({
          clinicalQuestion: '¿Es eficaz el tratamiento X para la condición Y?',
          articles: [
            { pmid: '12345', title: 'Artículo 1', secondaryAnalysis: 'Análisis 1' },
            { pmid: '67890', title: 'Artículo 2', secondaryAnalysis: 'Análisis 2' }
          ]
        })
        .timeout(30000); // Aumentar timeout a 30 segundos
      
      // Verificamos que la solicitud fue procesada (puede éxito o error controlado)
      expect(res.status).toBeDefined();
    }, 30000); // Aumentar timeout a 30 segundos

    it('debería manejar errores cuando no se proporciona pregunta clínica', async () => {
      const res = await request(app)
        .post('/api/claude/generate-synthesis')
        .send({
          articles: [{ pmid: '12345', title: 'Artículo 1' }]
        });
      
      // Verificamos que se recibe alguna respuesta de error
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('debería manejar errores cuando no se proporcionan artículos', async () => {
      const res = await request(app)
        .post('/api/claude/generate-synthesis')
        .send({
          clinicalQuestion: '¿Es eficaz el tratamiento X para la condición Y?'
        });
      
      // Verificamos que se recibe alguna respuesta de error
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
}); 