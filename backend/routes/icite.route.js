import { Router } from 'express';
import iciteController from '../controllers/iciteController.js';

const router = Router();

/**
 * @route GET /api/icite/:pmid
 * @desc Obtiene métricas iCite para un PMID
 * @access Public
 */
router.get('/:pmid', iciteController.getMetrics);

/**
 * @route POST /api/icite
 * @desc Obtiene métricas iCite para uno o varios PMIDs (en body o query)
 * @access Public
 */
router.post('/', iciteController.getMetrics);

export default router; 