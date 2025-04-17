/**
 * Servicio para manejar el historial de búsquedas
 * Almacena y recupera las consultas médicas realizadas por el usuario
 */

const STORAGE_KEY = 'scientific_search_history';
const MAX_HISTORY_ITEMS = 10;

class SearchHistoryService {
  constructor() {
    this.history = this.loadHistory();
  }

  /**
   * Carga el historial desde localStorage
   * @returns {Array} Historial de búsquedas
   */
  loadHistory() {
    try {
      const history = localStorage.getItem(STORAGE_KEY);
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('Error al cargar historial de búsquedas:', error);
      return [];
    }
  }

  /**
   * Guarda el historial en localStorage
   */
  saveHistory() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history));
    } catch (error) {
      console.error('Error al guardar historial de búsquedas:', error);
    }
  }

  /**
   * Añade una nueva búsqueda al historial
   * @param {Object} searchData - Datos de la búsqueda
   * @param {string} searchData.query - Consulta realizada
   * @param {boolean} searchData.useAI - Si se usó IA en la búsqueda
   * @param {number} searchData.resultsCount - Número de resultados encontrados
   */
  addSearch(searchData) {
    if (!searchData || !searchData.query) return;

    // Crear objeto de búsqueda con timestamp
    const search = {
      ...searchData,
      timestamp: new Date().toISOString(),
      id: Date.now().toString()
    };

    // Añadir al inicio y limitar a MAX_HISTORY_ITEMS
    this.history = [search, ...this.history.filter(item => 
      item.query !== search.query
    )].slice(0, MAX_HISTORY_ITEMS);
    
    this.saveHistory();
  }

  /**
   * Obtiene todo el historial de búsquedas
   * @returns {Array} Historial de búsquedas
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Elimina una búsqueda del historial por su ID
   * @param {string} id - ID de la búsqueda a eliminar
   */
  removeSearch(id) {
    if (!id) return;
    
    this.history = this.history.filter(item => item.id !== id);
    this.saveHistory();
  }

  /**
   * Limpia todo el historial de búsquedas
   */
  clearHistory() {
    this.history = [];
    this.saveHistory();
  }
}

export default new SearchHistoryService(); 