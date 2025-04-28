import { jest } from '@jest/globals';
import { validateQuestion } from '../middlewares/questionValidator.js';

describe('Middleware Validadores', () => {
  describe('validateQuestion', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        body: {}
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    it('debería permitir una pregunta clínica válida', () => {
      req.body.question = '¿Es efectivo el tratamiento con carvedilol para la prevención de varices esofágicas?';
      
      validateQuestion(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('debería rechazar peticiones sin pregunta clínica', () => {
      req.body = {}; // Sin pregunta
      
      validateQuestion(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false
      }));
    });

    it('debería rechazar preguntas demasiado cortas', () => {
      req.body.question = 'Hi'; // Muy corta (menos de 5 caracteres)
      
      validateQuestion(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('debería rechazar valores nulos o no válidos como pregunta', () => {
      req.body.question = null;
      
      validateQuestion(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      
      req.body.question = 123; // No es string
      
      validateQuestion(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('debería aceptar preguntas con estructura PICO correcta', () => {
      req.body.question = '¿En pacientes adultos con hipertensión portal (P), la administración de beta-bloqueantes no selectivos (I) comparado con placebo (C) reduce la incidencia de primera hemorragia por varices esofágicas (O)?';
      
      validateQuestion(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('debería aceptar preguntas en formato simple pero válidas', () => {
      req.body.question = '¿Cuál es la eficacia de los inhibidores de la bomba de protones en el tratamiento de la úlcera péptica?';
      
      validateQuestion(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
}); 