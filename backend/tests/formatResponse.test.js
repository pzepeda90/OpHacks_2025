import request from 'supertest';
import { jest } from '@jest/globals';
import express from 'express';
import claudeRoutes from '../routes/claude.route.js';

// Mock para el servicio de Claude que reproducirá el error
const mockClaudeService = {
  generateResponse: jest.fn().mockResolvedValue('Respuesta de ejemplo'),
  analyzeArticle: jest.fn(),
  analyzeArticleBatch: jest.fn()
};

// Mock del módulo claudeService
jest.mock('../services/claudeService.js', () => ({
  __esModule: true,
  default: mockClaudeService
}));

// Crear una app Express para las pruebas
const app = express();
app.use(express.json());
app.use('/api/claude', claudeRoutes);

describe('Manejo de errores de formato de respuesta', () => {
  
  beforeEach(() => {
    // Limpiar mocks antes de cada prueba
    jest.clearAllMocks();
  });
  
  describe('POST /api/claude/analyze-article', () => {
    
    it('debería manejar correctamente cuando Claude devuelve una respuesta válida', async () => {
      // Configurar el mock para devolver una respuesta válida
      mockClaudeService.analyzeArticle.mockResolvedValueOnce(`
        <div class="card-analysis">
          <div class="card-header">
            <h3>ANÁLISIS DE EVIDENCIA</h3>
            <div class="badges">
              <span class="badge quality">★★★★☆</span>
              <span class="badge type">Meta-análisis</span>
            </div>
          </div>
          <div class="card-section">
            <h4>RESUMEN CLÍNICO</h4>
            <p>Análisis de ejemplo</p>
          </div>
        </div>
      `);
      
      const res = await request(app)
        .post('/api/claude/analyze-article')
        .send({
          article: {
            pmid: '12345',
            title: 'Artículo de prueba',
            abstract: 'Resumen del artículo'
          },
          clinicalQuestion: '¿Es eficaz el tratamiento X para la condición Y?'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.content).toBeDefined();
      expect(mockClaudeService.analyzeArticle).toHaveBeenCalledTimes(1);
    }, 15000);
    
    it('debería manejar correctamente cuando Claude devuelve formato de respuesta inválido', async () => {
      // Configurar el mock para simular el error "Formato de respuesta inválido"
      mockClaudeService.analyzeArticle.mockRejectedValueOnce(new Error('Formato de respuesta inválido'));
      
      const res = await request(app)
        .post('/api/claude/analyze-article')
        .send({
          article: {
            pmid: '12345',
            title: 'Artículo de prueba',
            abstract: 'Resumen del artículo'
          },
          clinicalQuestion: '¿Es eficaz el tratamiento X para la condición Y?'
        });
      
      // El controlador debería devolver un error 500 cuando el servicio falla
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Formato de respuesta inválido');
      expect(mockClaudeService.analyzeArticle).toHaveBeenCalledTimes(1);
    }, 15000);
  });
  
  describe('POST /api/claude/analyze-batch', () => {
    it('debería manejar correctamente cuando algunos artículos fallan con formato de respuesta inválido', async () => {
      // Simular que algunos artículos en el lote tienen éxito y otros fallan
      mockClaudeService.analyzeArticleBatch.mockResolvedValueOnce([
        // Artículo exitoso
        {
          pmid: '12345',
          title: 'Artículo 1',
          secondaryAnalysis: '<div class="card-analysis">...</div>',
          analyzed: true
        },
        // Artículo con error de formato
        {
          pmid: '67890',
          title: 'Artículo 2',
          secondaryAnalysis: '<div class="card-analysis"><div class="card-header"><h3>ANÁLISIS DE EVIDENCIA</h3><div class="badges"><span class="badge quality">★☆☆☆☆</span><span class="badge type">Error</span></div></div><div class="card-section"><h4>ERROR DE ANÁLISIS</h4><p>No fue posible analizar este artículo. Error: Formato de respuesta inválido</p></div></div>',
          error: true,
          analyzed: false
        }
      ]);
      
      const res = await request(app)
        .post('/api/claude/analyze-batch')
        .send({
          articles: [
            { pmid: '12345', title: 'Artículo 1' },
            { pmid: '67890', title: 'Artículo 2' }
          ],
          clinicalQuestion: '¿Es eficaz el tratamiento X para la condición Y?'
        });
      
      // La respuesta del lote debería ser exitosa incluso con errores individuales
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body.results.length).toBe(2);
      
      // Verificar que un artículo fue exitoso y otro tuvo error
      const successfulArticle = res.body.results.find(a => a.pmid === '12345');
      const failedArticle = res.body.results.find(a => a.pmid === '67890');
      
      expect(successfulArticle.analyzed).toBe(true);
      expect(failedArticle.error).toBe(true);
      expect(failedArticle.secondaryAnalysis).toContain('ERROR DE ANÁLISIS');
      expect(failedArticle.secondaryAnalysis).toContain('Formato de respuesta inválido');
      
      expect(mockClaudeService.analyzeArticleBatch).toHaveBeenCalledTimes(1);
    }, 15000);
    
    it('debería manejar un error fatal en todo el procesamiento por lotes', async () => {
      // Simular un error fatal en el procesamiento por lotes
      mockClaudeService.analyzeArticleBatch.mockRejectedValueOnce(
        new Error('Error crítico en el procesamiento por lotes')
      );
      
      const res = await request(app)
        .post('/api/claude/analyze-batch')
        .send({
          articles: [
            { pmid: '12345', title: 'Artículo 1' },
            { pmid: '67890', title: 'Artículo 2' }
          ],
          clinicalQuestion: '¿Es eficaz el tratamiento X para la condición Y?'
        });
      
      // Debería devolver un error 500 cuando todo el lote falla
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Error crítico en el procesamiento por lotes');
      expect(mockClaudeService.analyzeArticleBatch).toHaveBeenCalledTimes(1);
    }, 15000);
  });
}); 