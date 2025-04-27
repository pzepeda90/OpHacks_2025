import { Router } from 'express';
import iciteController from '../controllers/iciteController.js';

const router = Router();

/**
 * @route GET /api/icite/:pmid
 * @desc Obtiene los datos de iCite para un solo PMID
 * @access Public
 */
router.get('/:pmid', iciteController.getByPmid);

/**
 * @route POST /api/icite/batch
 * @desc Obtiene los datos de iCite para varios PMIDs
 * @access Public
 */
router.post('/batch', iciteController.getBatch);

export default router; 