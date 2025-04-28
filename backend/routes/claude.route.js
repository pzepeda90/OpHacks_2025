/**
 * Rutas para la API de Claude
 */
import { Router } from 'express';
import claudeController from '../controllers/claudeController.js';

const router = Router();

/**
 * @route POST /api/claude/generate-strategy
 * @description Genera una estrategia de búsqueda basada en una pregunta clínica
 * @access Public
 */
router.post('/generate-strategy', claudeController.generateStrategy);

/**
 * @route POST /api/claude/analyze-article
 * @description Analiza un artículo científico
 * @access Public
 */
router.post('/analyze-article', claudeController.analyzeArticle);

/**
 * @route POST /api/claude/analyze-batch
 * @description Analiza un lote de artículos científicos
 * @access Public
 */
router.post('/analyze-batch', claudeController.analyzeArticleBatch);

/**
 * @route POST /api/claude/filter-by-titles
 * @description Filtra artículos basados en la relevancia de sus títulos
 * @access Public
 */
router.post('/filter-by-titles', claudeController.filterByTitles);

/**
 * @route POST /api/claude/generate-synthesis
 * @description Genera una síntesis crítica de la evidencia científica
 * @access Public
 */
router.post('/generate-synthesis', claudeController.generateSynthesis);

// Mantener rutas antiguas para compatibilidad
router.post('/strategy', claudeController.generateStrategy);
router.post('/analyze', claudeController.analyzeArticle);
router.post('/synthesis', claudeController.generateSynthesis);

export default router; 