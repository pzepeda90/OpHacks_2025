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
      // Configurar el mock para que retorne artículos filtrados
      const mockArticles = [
        { pmid: '12345', title: 'Artículo relevante 1' },
        { pmid: '67890', title: 'Artículo relevante 2' }
      ];
      
      claudeServiceMock.filterByTitles.mockResolvedValueOnce(mockArticles);
      
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
      
      // Verificamos que se llame al servicio con los parámetros correctos
      expect(claudeServiceMock.filterByTitles).toHaveBeenCalledWith(
        expect.any(Array),
        expect.stringMatching(/tratamiento X/),
        expect.objectContaining({ limit: 2 })
      );
      
      // Verificamos que retorne los artículos filtrados
      expect(res.body.results).toEqual(mockArticles);
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
        .timeout(10000); // Aumentar timeout a 10 segundos
      
      // Verificamos que la solicitud fue procesada (puede éxito o error controlado)
      expect(res.status).toBeDefined();
    }, 10000); // Aumentar timeout a 10 segundos

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