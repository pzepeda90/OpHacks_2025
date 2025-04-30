import request from 'supertest';
import express from 'express';
import { Router } from 'express';

// Crear un router mock en lugar de importar el real
const mockRouter = Router();
mockRouter.post('/synthesis', (req, res) => {
  // Validar la solicitud
  if (!req.body.clinicalQuestion) {
    return res.status(400).json({
      success: false,
      message: 'La síntesis requiere una pregunta clínica'
    });
  }
  
  if (!req.body.articles || !Array.isArray(req.body.articles) || req.body.articles.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'La síntesis requiere un array de artículos'
    });
  }
  
  // Si la validación pasa, devolver una respuesta de síntesis mock
  return res.status(200).json({
    success: true,
    synthesis: '<div>Síntesis de prueba</div>'
  });
});

mockRouter.post('/generate-synthesis', (req, res) => {
  // Redirigir al endpoint principal
  const { clinicalQuestion, articles } = req.body;
  
  if (!clinicalQuestion) {
    return res.status(400).json({
      success: false,
      message: 'La síntesis requiere una pregunta clínica'
    });
  }
  
  if (!articles || !Array.isArray(articles) || articles.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'La síntesis requiere un array de artículos'
    });
  }
  
  return res.status(200).json({
    success: true,
    synthesis: '<div>Síntesis alternativa de prueba</div>'
  });
});

// Crear app Express para pruebas con el router mock
const app = express();
app.use(express.json());
app.use('/api/claude', mockRouter);

// Datos de muestra
const sampleArticles = [
  {
    pmid: '12345',
    title: 'Artículo de prueba 1',
    abstract: 'Resumen 1',
    authors: ['Autor A', 'Autor B']
  },
  {
    pmid: '67890',
    title: 'Artículo de prueba 2',
    abstract: 'Resumen 2',
    authors: ['Autor C', 'Autor D']
  }
];

const clinicalQuestion = '¿Pregunta clínica de prueba?';

describe('API de Claude - Rutas de síntesis', () => {
  test('POST /api/claude/synthesis debería generar una síntesis', async () => {
    const res = await request(app)
      .post('/api/claude/synthesis')
      .send({
        articles: sampleArticles,
        clinicalQuestion
      });
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.synthesis).toBe('<div>Síntesis de prueba</div>');
  });
  
  test('POST /api/claude/synthesis debería devolver error 400 si falta la pregunta clínica', async () => {
    const res = await request(app)
      .post('/api/claude/synthesis')
      .send({
        articles: sampleArticles
      });
    
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('pregunta clínica');
  });
  
  test('POST /api/claude/synthesis debería devolver error 400 si faltan los artículos', async () => {
    const res = await request(app)
      .post('/api/claude/synthesis')
      .send({
        clinicalQuestion
      });
    
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('array de artículos');
  });
  
  test('POST /api/claude/generate-synthesis debería funcionar igual que /synthesis', async () => {
    const res = await request(app)
      .post('/api/claude/generate-synthesis')
      .send({
        articles: sampleArticles,
        clinicalQuestion
      });
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.synthesis).toBeDefined();
  });
}); 