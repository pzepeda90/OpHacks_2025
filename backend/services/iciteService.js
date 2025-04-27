import axios from 'axios';
import config from '../config/index.js';
import ICite from '../models/iCite.js';

class ICiteService {
  constructor() {
    this.baseUrl = config.apis.icite.baseUrl;
  }

  /**
   * Obtiene los datos de iCite para uno o varios PMIDs
   * @param {string|string[]} pmids - Un PMID o un array de PMIDs
   * @returns {Promise<ICite|ICite[]>}
   */
  async getByPmids(pmids) {
    if (!pmids) throw new Error('Se requiere al menos un PMID');
    let pmidList = Array.isArray(pmids) ? pmids : [pmids];
    const url = `${this.baseUrl}/pubs`;
    const params = { pmids: pmidList.join(',') };
    try {
      const response = await axios.get(url, { params });
      if (response.data && Array.isArray(response.data.data)) {
        const results = response.data.data.map(item => new ICite(item));
        return Array.isArray(pmids) ? results : results[0];
      } else {
        throw new Error('Respuesta inesperada de la API de iCite');
      }
    } catch (error) {
      console.error('Error al consultar la API de iCite:', error.message);
      throw error;
    }
  }
}

export default new ICiteService(); 