import iciteService from '../services/iciteService.js';

const iciteController = {
  /**
   * Obtiene métricas iCite para uno o varios PMIDs
   * @route GET /api/icite/:pmid
   * @route POST /api/icite
   * @param req
   * @param res
   */
  async getMetrics(req, res) {
    try {
      let pmids = req.params.pmid || req.query.pmids || req.body.pmids;
      if (!pmids) {
        return res.status(400).json({ error: 'Debe proporcionar al menos un PMID (por parámetro, query o body)' });
      }
      if (typeof pmids === 'string' && pmids.includes(',')) {
        pmids = pmids.split(',').map(p => p.trim());
      }
      // Si viene como string único, dejarlo así
      const metrics = await iciteService.getMetrics(pmids);
      res.json({ success: true, results: metrics });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

export default iciteController; 