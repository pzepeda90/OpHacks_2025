/**
 * Rutas para consultas científicas
 */
import express from 'express';
import scientificQueryController from '../controllers/scientificQueryController.js';
import { validateQuestion } from '../middlewares/questionValidator.js';

const router = express.Router();

/**
 * @route POST /api/scientific-query
 * @desc Procesa una consulta científica usando IA y PubMed
 * @access Public
 */
router.post('/', validateQuestion, scientificQueryController.processQuery);

/**
 * @route POST /api/scientific-query/search
 * @desc Busca artículos en PubMed usando una estrategia de búsqueda
 * @access Public
 */
router.post('/search', scientificQueryController.searchArticles);

/**
 * @route GET /api/scientific-query/article/:pmid
 * @desc Obtiene detalles de un artículo específico por PMID
 * @access Public
 */
router.get('/article/:pmid', scientificQueryController.getArticleDetails);

/**
 * @route POST /api/scientific-query/analyze
 * @desc Analiza un artículo específico con IA
 * @access Public
 */
router.post('/analyze', scientificQueryController.analyzeArticle);

export default router; 