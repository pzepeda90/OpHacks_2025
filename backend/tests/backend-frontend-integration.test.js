import request from 'supertest';
import { jest } from '@jest/globals';
import express from 'express';
import scientificQueryRoutes from '../routes/scientificQuery.route.js';
import claudeRoutes from '../routes/claude.route.js';
import { pubmedServiceMock, claudeServiceMock, iciteServiceMock } from './__mocks__/services.js';

// Incrementar el timeout global para pruebas
jest.setTimeout(30000);

// Mockear los servicios
jest.mock('../services/pubmedService.js', () => ({
  __esModule: true,
  default: pubmedServiceMock
}));

jest.mock('../services/claudeService.js', () => ({
  __esModule: true,
  default: claudeServiceMock
}));

jest.mock('../services/iciteService.js', () => ({
  __esModule: true,
  default: iciteServiceMock
}));

// Crear una app Express para pruebas
const app = express();
app.use(express.json());
app.use('/api/scientific-query', scientificQueryRoutes);
app.use('/api/claude', claudeRoutes);

// Datos de ejemplo que el frontend enviará
const sampleQuestion = '¿Cuál es la eficacia de la metformina en pacientes con diabetes tipo 2?';
const samplePmid = '12345678';
const sampleArticle = {
  pmid: samplePmid,
  title: 'Eficacia de la metformina en pacientes con diabetes tipo 2',
  abstract: 'Este estudio evalúa la eficacia de la metformina en el tratamiento de la diabetes tipo 2...',
  authors: [{ name: 'García, J.' }, { name: 'Martínez, A.' }],
  publicationDate: '2023-01-15'
};

// Función para esperar a que todas las promesas del event loop terminen
const flushPromises = () => new Promise(resolve => setImmediate(resolve));

// Restablecer mocks antes de cada prueba
beforeEach(() => {
  jest.clearAllMocks();
  // Configurar comportamientos predeterminados de los mocks
  pubmedServiceMock.search.mockResolvedValue([sampleArticle]);
  pubmedServiceMock.getArticleByPmid.mockResolvedValue(sampleArticle);
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
        <p>Análisis detallado del artículo sobre metformina en diabetes tipo 2.</p>
      </div>
    </div>
  `);
});

// Limpiar después de todas las pruebas
afterAll(async () => {
  // Esperar a que todas las operaciones pendientes terminen
  await flushPromises();
});

describe('Integración Backend-Frontend', () => {
  describe('Flujo de búsqueda científica', () => {
    it('debería procesar una consulta y devolver resultados estructurados correctamente para el frontend', async () => {
      const res = await request(app)
        .post('/api/scientific-query')
        .send({
          question: sampleQuestion,
          useAI: true
        });
      
      // Verificar status y estructura general de la respuesta
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      
      // Verificar que la respuesta contiene los campos necesarios para el frontend
      expect(res.body).toHaveProperty('articles');
      expect(res.body).toHaveProperty('searchStrategy');
      expect(res.body).toHaveProperty('enhancedStrategy');
      expect(res.body).toHaveProperty('sessionId');
      
      // Verificar estructura de artículos
      expect(Array.isArray(res.body.articles)).toBe(true);
      if (res.body.articles.length > 0) {
        const article = res.body.articles[0];
        expect(article).toHaveProperty('pmid');
        expect(article).toHaveProperty('title');
      }
      
      // Verificar que la estrategia de búsqueda tiene el formato correcto
      expect(typeof res.body.searchStrategy).toBe('string');
      expect(typeof res.body.enhancedStrategy).toBe('string');
      
      // Verificar que se llamaron a los servicios correctos
      expect(claudeServiceMock.generateSearchStrategy).toHaveBeenCalledWith(sampleQuestion);
      expect(pubmedServiceMock.search).toHaveBeenCalled();
      
      // Esperar a que se completen las promesas pendientes
      await flushPromises();
    });
  });

  describe('Análisis de artículos', () => {
    it('debería devolver el análisis de un artículo en formato HTML adecuado para el frontend', async () => {
      const res = await request(app)
        .post('/api/scientific-query/analyze')
        .send({
          pmid: samplePmid,
          question: sampleQuestion
        });
      
      // Verificar respuesta
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('analysis');
      
      // Verificar que el análisis es HTML y contiene elementos esperados
      const analysis = res.body.analysis;
      expect(analysis).toContain('<div class="card-analysis">');
      expect(analysis).toContain('<span class="badge quality">');
      expect(analysis).toContain('<h4>RESUMEN CLÍNICO</h4>');
      
      // Verificar que se llamaron a los servicios correctos con los parámetros adecuados
      expect(pubmedServiceMock.getArticleByPmid).toHaveBeenCalledWith(samplePmid);
      expect(claudeServiceMock.analyzeArticle).toHaveBeenCalled();
      
      // Esperar a que se completen las promesas pendientes
      await flushPromises();
    });
  });

  describe('Procesamiento por lotes', () => {
    it('debería analizar un lote de artículos y devolver resultados estructurados para el frontend', async () => {
      // Configurar el mock para devolver artículos analizados
      claudeServiceMock.analyzeArticleBatch.mockResolvedValue([
        {
          ...sampleArticle,
          secondaryAnalysis: '<div class="card-analysis">Análisis del artículo 1</div>',
          analyzed: true
        }
      ]);
      
      const res = await request(app)
        .post('/api/claude/analyze-batch')
        .send({
          articles: [sampleArticle],
          question: sampleQuestion
        });
      
      // Verificar respuesta
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('results');
      
      // Verificar estructura de resultados
      expect(Array.isArray(res.body.results)).toBe(true);
      if (res.body.results.length > 0) {
        const processedArticle = res.body.results[0];
        expect(processedArticle).toHaveProperty('pmid');
        expect(processedArticle).toHaveProperty('secondaryAnalysis');
        expect(processedArticle).toHaveProperty('analyzed', true);
        expect(processedArticle.secondaryAnalysis).toContain('<div class="card-analysis">');
      }
      
      // Verificar que se llamó al servicio correcto
      expect(claudeServiceMock.analyzeArticleBatch).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ pmid: samplePmid })]),
        sampleQuestion
      );
      
      // Esperar a que se completen las promesas pendientes
      await flushPromises();
    });
  });

  describe('Manejo de errores para el frontend', () => {
    it('debería devolver errores en formato adecuado para el frontend', async () => {
      // Simular un error en la búsqueda
      pubmedServiceMock.search.mockRejectedValueOnce(new Error('Error en la búsqueda'));
      
      const res = await request(app)
        .post('/api/scientific-query/search')
        .send({ query: 'diabetes' });
      
      // Verificar que el error se devuelve estructurado
      expect(res.status).toBe(500); // o el código que corresponda según la implementación
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error).toBe('string');
      
      // Esperar a que se completen las promesas pendientes
      await flushPromises();
    });
    
    it('debería manejar errores de validación y devolver mensajes claros', async () => {
      const res = await request(app)
        .post('/api/scientific-query/analyze')
        .send({ 
          // Omitir el PMID para provocar un error de validación
          question: sampleQuestion
        });
      
      // Verificar que el error de validación se devuelve correctamente
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
      
      // Esperar a que se completen las promesas pendientes
      await flushPromises();
    });
  });
}); 