import request from 'supertest';
import { jest } from '@jest/globals';
import express from 'express';
import claudeRoutes from '../routes/claude.route.js';
import { claudeServiceMock } from './__mocks__/services.js';

// Incrementar el timeout global para pruebas
jest.setTimeout(60000);

// Mockear el servicio Claude
jest.mock('../services/claudeService.js', () => ({
  __esModule: true,
  default: claudeServiceMock
}));

// Crear una app Express para pruebas
const app = express();
app.use(express.json());
app.use('/api/claude', claudeRoutes);

// Función para esperar a que todas las promesas del event loop terminen
const flushPromises = () => new Promise(resolve => setImmediate(resolve));

// Antes de cada prueba, limpiar mocks
beforeEach(() => {
  jest.clearAllMocks();
  // Restablecer comportamiento predeterminado de los mocks
  claudeServiceMock.generateSearchStrategy.mockResolvedValue({
    strategy: '("Metformin"[Mesh] AND "Diabetes Mellitus, Type 2"[Mesh])',
    fullResponse: 'Respuesta completa de Claude',
    enhancedResponse: '<div>Estrategia de búsqueda HTML</div>',
    metrics: {
      sensibilidad: 85,
      especificidad: 90,
      precision: 75,
      nnr: 1.3,
      saturacion: 92
    }
  });
  
  claudeServiceMock.analyzeArticle.mockResolvedValue(`
    <div class="card-analysis">
      <div class="card-header">
        <h3>ANÁLISIS DE EVIDENCIA</h3>
        <div class="badges">
          <span class="badge quality">★★★★☆</span>
          <span class="badge type">Ensayo clínico</span>
        </div>
      </div>
      <div class="card-section">
        <h4>RESUMEN CLÍNICO</h4>
        <p>Análisis detallado del artículo.</p>
      </div>
    </div>
  `);
  
  claudeServiceMock.analyzeArticleBatch.mockResolvedValue([
    {
      pmid: '12345678',
      title: 'Título del artículo',
      secondaryAnalysis: '<div>Análisis detallado</div>',
      analyzed: true
    }
  ]);
  
  claudeServiceMock.filterByTitles.mockResolvedValue([
    {
      pmid: '12345678',
      title: 'Título del artículo',
      relevance: 95
    }
  ]);
  
  claudeServiceMock.generateSynthesis.mockResolvedValue('<div>Síntesis de la evidencia</div>');
});

// Limpiar después de todas las pruebas
afterAll(async () => {
  // Esperar a que todas las operaciones pendientes terminen
  await flushPromises();
});

describe('Claude API', () => {
  describe('POST /api/claude/generate-strategy', () => {
    it('debería recibir una respuesta exitosa al generar una estrategia de búsqueda', async () => {
      const res = await request(app)
        .post('/api/claude/generate-strategy')
        .send({
          question: '¿Cuál es la eficacia de la metformina en pacientes con diabetes tipo 2?'
        });
        
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.content).toHaveProperty('strategy');
      expect(res.body.content).toHaveProperty('fullResponse');
      expect(res.body.content).toHaveProperty('enhancedResponse');
      expect(res.body.content).toHaveProperty('metrics');
      
      // Esperar a que se completen las promesas pendientes
      await flushPromises();
    });
    
    it('debería manejar errores cuando no se proporciona un prompt', async () => {
      const res = await request(app)
        .post('/api/claude/generate-strategy')
        .send({});
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      
      // Esperar a que se completen las promesas pendientes
      await flushPromises();
    });
  });
  
  describe('POST /api/claude/analyze-article', () => {
    it('debería recibir una respuesta exitosa al analizar un artículo con prompt', async () => {
      const res = await request(app)
        .post('/api/claude/analyze-article')
        .send({
          prompt: 'Analiza este artículo: "Efficacy of metformin in type 2 diabetes"'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.analysis).toBeDefined();
      expect(typeof res.body.analysis).toBe('string');
      
      // Esperar a que se completen las promesas pendientes
      await flushPromises();
    });
    
    it('debería recibir una respuesta exitosa al analizar un artículo con datos', async () => {
      const res = await request(app)
        .post('/api/claude/analyze')
        .send({
          article: {
            pmid: '12345678',
            title: 'Efficacy of metformin in type 2 diabetes',
            abstract: 'Abstract detallado del artículo sobre metformina',
            authors: [{ name: 'Autor 1' }, { name: 'Autor 2' }],
            publicationDate: '2023-01-01'
          },
          clinicalQuestion: '¿Es eficaz el tratamiento X para la condición Y?'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.analysis).toBeDefined();
      
      // Esperar a que se completen las promesas pendientes
      await flushPromises();
    });
    
    it('debería manejar errores cuando no se proporcionan datos', async () => {
      const res = await request(app)
        .post('/api/claude/analyze')
        .send({});
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      
      // Esperar a que se completen las promesas pendientes
      await flushPromises();
    });
    
    it('debería manejar correctamente artículos con diferentes formatos de authors', async () => {
      // Configurar el mock para simular el comportamiento correcto
      claudeServiceMock.analyzeArticle.mockImplementation((article) => {
        // Verificar si authors es un array, de lo contrario, convertirlo
        if (article.authors && !Array.isArray(article.authors)) {
          article.authors = [{ name: article.authors }];
        }
        
        // Devolver un análisis simulado
        return Promise.resolve('<div>Análisis simulado</div>');
      });
      
      const res = await request(app)
        .post('/api/claude/analyze')
        .send({
          article: {
            pmid: '12345678',
            title: 'Título de prueba',
            abstract: 'Abstract de prueba',
            authors: 'Autor único como string',
            publicationDate: '2023-01-01'
          },
          clinicalQuestion: '¿Cuál es la eficacia del tratamiento?'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.analysis).toBeDefined();
      expect(claudeServiceMock.analyzeArticle).toHaveBeenCalled();
      
      // Esperar a que se completen las promesas pendientes
      await flushPromises();
    });
  });
  
  describe('POST /api/claude/analyze-batch', () => {
    it('debería procesar un lote de artículos', async () => {
      const res = await request(app)
        .post('/api/claude/analyze-batch')
        .send({
          articles: [
            {
              pmid: '12345678',
              title: 'Título del artículo 1',
              abstract: 'Abstract detallado'
            },
            {
              pmid: '87654321',
              title: 'Título del artículo 2',
              abstract: 'Abstract detallado del segundo artículo'
            }
          ],
          question: '¿Cuál es la eficacia de la metformina en pacientes con diabetes tipo 2?'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results).toBeDefined();
      expect(Array.isArray(res.body.results)).toBe(true);
      
      // Esperar a que se completen las promesas pendientes
      await flushPromises();
    });
    
    it('debería manejar errores de rate limit (429) y reintentar', async () => {
      // Configurar el mock para simular un error de rate limit y luego éxito
      claudeServiceMock.analyzeArticleBatch
        .mockRejectedValueOnce(new Error('Error de rate limit 429'))
        .mockResolvedValueOnce([
          {
            pmid: '12345678',
            secondaryAnalysis: '<div>Análisis después de reintento</div>',
            analyzed: true
          }
        ]);
      
      const res = await request(app)
        .post('/api/claude/analyze-batch')
        .send({
          articles: [{ pmid: '12345678', title: 'Artículo de prueba' }],
          question: '¿Pregunta clínica de prueba?'
        });
      
      // Verificamos que se manejó el error y se recibió una respuesta
      expect(res.status).toBe(200);
      expect(claudeServiceMock.analyzeArticleBatch).toHaveBeenCalledTimes(2); // Verifica que se hizo un reintento
      expect(res.body.success).toBe(true);
      
      // Esperar a que se completen las promesas pendientes
      await flushPromises();
    });
    
    it('debería manejar múltiples errores de rate limit (429) consecutivos', async () => {
      // Configurar el mock para simular múltiples errores de rate limit
      const rateLimitError = new Error('Error de rate limit 429');
      rateLimitError.response = { status: 429 };
      
      claudeServiceMock.analyzeArticleBatch
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValue(rateLimitError); // Rechazar todas las llamadas posteriores
      
      const res = await request(app)
        .post('/api/claude/analyze-batch')
        .send({
          articles: [{ pmid: '12345678', title: 'Artículo de prueba' }],
          question: '¿Pregunta clínica de prueba?'
        });
      
      // Verificamos que se manejó correctamente el error persistente de rate limit
      expect(res.status).toBe(500); // Debería dar error 500 después de agotar reintentos
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error).toContain('rate limit');
      
      // Esperar a que se completen las promesas pendientes
      await flushPromises();
    });
    
    it('debería retornar un error si no se proporcionan artículos', async () => {
      const res = await request(app)
        .post('/api/claude/analyze-batch')
        .send({
          question: '¿Pregunta clínica?'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      
      // Esperar a que se completen las promesas pendientes
      await flushPromises();
    });
    
    it('debería retornar un error si no se proporciona una pregunta clínica', async () => {
      const res = await request(app)
        .post('/api/claude/analyze-batch')
        .send({
          articles: [{ pmid: '12345678', title: 'Artículo de prueba' }]
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      
      // Esperar a que se completen las promesas pendientes
      await flushPromises();
    });
  });
  
  describe('POST /api/claude/filter-by-titles', () => {
    it('debería filtrar artículos por títulos correctamente', async () => {
      const res = await request(app)
        .post('/api/claude/filter-by-titles')
        .send({
          articles: [
            { pmid: '12345678', title: 'Título del artículo 1' },
            { pmid: '87654321', title: 'Título del artículo 2' }
          ],
          question: '¿Cuál es la eficacia de la metformina en pacientes con diabetes tipo 2?',
          limit: 10
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.filteredArticles).toBeDefined();
      expect(Array.isArray(res.body.filteredArticles)).toBe(true);
      
      // Esperar a que se completen las promesas pendientes
      await flushPromises();
    });
    
    it('debería manejar errores cuando no se proporcionan artículos', async () => {
      const res = await request(app)
        .post('/api/claude/filter-by-titles')
        .send({
          question: '¿Cuál es la eficacia de la metformina?'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      
      // Esperar a que se completen las promesas pendientes
      await flushPromises();
    });
    
    it('debería manejar errores cuando no se proporciona una pregunta', async () => {
      const res = await request(app)
        .post('/api/claude/filter-by-titles')
        .send({
          articles: [{ pmid: '12345678', title: 'Título del artículo' }]
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      
      // Esperar a que se completen las promesas pendientes
      await flushPromises();
    });
  });
  
  describe('POST /api/claude/generate-synthesis', () => {
    it('debería procesar una solicitud de síntesis', async () => {
      const res = await request(app)
        .post('/api/claude/generate-synthesis')
        .send({
          articles: [
            {
              pmid: '12345678',
              title: 'Título del artículo',
              abstract: 'Abstract detallado',
              secondaryAnalysis: '<div>Análisis del artículo</div>'
            }
          ],
          clinicalQuestion: '¿Cuál es la eficacia de la metformina?'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.synthesis).toBeDefined();
      expect(typeof res.body.synthesis).toBe('string');
      
      // Esperar a que se completen las promesas pendientes
      await flushPromises();
    });
    
    it('debería manejar errores cuando no se proporciona pregunta clínica', async () => {
      const res = await request(app)
        .post('/api/claude/generate-synthesis')
        .send({
          articles: [{ pmid: '12345678', title: 'Título del artículo' }]
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      
      // Esperar a que se completen las promesas pendientes
      await flushPromises();
    });
    
    it('debería manejar errores cuando no se proporcionan artículos', async () => {
      const res = await request(app)
        .post('/api/claude/generate-synthesis')
        .send({
          clinicalQuestion: '¿Cuál es la eficacia de la metformina?'
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      
      // Esperar a que se completen las promesas pendientes
      await flushPromises();
    });
  });
}); 