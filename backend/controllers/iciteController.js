import iciteService from '../services/iciteService.js';

const iciteController = {
  /**
   * Obtiene los datos de iCite para un solo PMID
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  getByPmid: async (req, res) => {
    try {
      const { pmid } = req.params;
      if (!pmid) {
        return res.status(400).json({ success: false, message: 'Se requiere un PMID' });
      }
      const data = await iciteService.getByPmids(pmid);
      if (!data) {
        return res.status(404).json({ success: false, message: 'No se encontró información para el PMID proporcionado' });
      }
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('Error en getByPmid:', error);
      return res.status(500).json({ success: false, message: error.message || 'Error interno del servidor' });
    }
  },

  /**
   * Obtiene los datos de iCite para varios PMIDs
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  getBatch: async (req, res) => {
    try {
      const { pmids } = req.body;
      if (!pmids || !Array.isArray(pmids) || pmids.length === 0) {
        return res.status(400).json({ success: false, message: 'Se requiere un array de PMIDs' });
      }
      const data = await iciteService.getByPmids(pmids);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('Error en getBatch:', error);
      return res.status(500).json({ success: false, message: error.message || 'Error interno del servidor' });
    }
  }
};

export default iciteController; 