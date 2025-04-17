/**
 * Rutas para la API de Claude
 */
import { Router } from 'express';
import claudeController from '../controllers/claudeController.js';

const router = Router();

/**
 * @route POST /api/claude/strategy
 * @description Genera una estrategia de búsqueda basada en una pregunta clínica
 * @access Public
 */
router.post('/strategy', claudeController.generateStrategy);

/**
 * @route POST /api/claude/analyze
 * @description Analiza un artículo científico
 * @access Public
 */
router.post('/analyze', claudeController.analyzeArticle);

/**
 * @route POST /api/claude/analyze-batch
 * @description Analiza un lote de artículos científicos
 * @access Public
 */
router.post('/analyze-batch', claudeController.analyzeArticleBatch);

/**
 * @route POST /api/claude/synthesis
 * @description Genera una síntesis crítica de la evidencia científica
 * @access Public
 */
router.post('/synthesis', claudeController.generateSynthesis);

export default router; 