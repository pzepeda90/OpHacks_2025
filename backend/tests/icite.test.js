import request from 'supertest';
import { jest } from '@jest/globals';
import express from 'express';
import iciteRoutes from '../routes/icite.route.js';
import { iciteServiceMock } from './__mocks__/services.js';

// Mockear el servicio de iCite
jest.mock('../services/iciteService.js', () => ({
  __esModule: true,
  default: iciteServiceMock
}));

// Crear una app Express para pruebas
const app = express();
app.use(express.json());
app.use('/api/icite', iciteRoutes);

// Configurar mocks antes de cada prueba
beforeEach(() => {
  jest.clearAllMocks();
});

describe('iCite API', () => {
  describe('GET /api/icite/:pmid', () => {
    it('debería obtener los datos de iCite para un PMID específico', async () => {
      const res = await request(app)
        .get('/api/icite/12345');
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('pmid');
      expect(res.body.data).toHaveProperty('relative_citation_ratio', 1.5);
      expect(iciteServiceMock.getByPmids).toHaveBeenCalledWith('12345');
    });

    it('debería manejar errores de la API de iCite', async () => {
      iciteServiceMock.getByPmids.mockRejectedValueOnce(new Error('Error de iCite API'));
      
      const res = await request(app)
        .get('/api/icite/12345');
      
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/icite/batch', () => {
    it('debería obtener los datos de iCite para múltiples PMIDs', async () => {
      const res = await request(app)
        .post('/api/icite/batch')
        .send({
          pmids: ['12345', '67890']
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0]).toHaveProperty('pmid');
      expect(res.body.data[1]).toHaveProperty('pmid');
      expect(iciteServiceMock.getByPmids).toHaveBeenCalledWith(['12345', '67890']);
    });

    it('debería retornar un error si no se proporcionan PMIDs', async () => {
      const res = await request(app)
        .post('/api/icite/batch')
        .send({});
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('debería manejar un array vacío de PMIDs', async () => {
      const res = await request(app)
        .post('/api/icite/batch')
        .send({
          pmids: []
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
}); 