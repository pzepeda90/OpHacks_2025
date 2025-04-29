/**
 * Modelo para representar artículos científicos
 * En una implementación completa, esto podría usar un ORM como Sequelize o Mongoose
 */

/**
 * Clase que representa un artículo científico
 */
class Article {
  /**
   * Crea un nuevo artículo científico a partir de datos de PubMed
   * @param {Object} data - Datos del artículo de PubMed
   */
  constructor(data) {
    if (!data) data = {};
    
    this.pmid = data.pmid || null;
    this.doi = data.doi || null;
    
    // Asegurar que el título sea procesado correctamente
    this.title = this._sanitizeTitle(data.title) || 'Sin título';
    
    // Asegurar que los autores estén en formato correcto
    this.authors = this._processAuthors(data.authors);
    
    this.publicationDate = data.pubdate || data.publicationDate || null;
    this.abstract = data.abstract || '';
    this.meshTerms = Array.isArray(data.meshTerms) ? data.meshTerms : [];
    this.secondaryAnalysis = data.secondaryAnalysis || null;
    this.journal = data.journal || data.source || null;
    this.fullTextUrl = data.fullTextUrl || this.generatePubMedUrl();
    
    // Campos adicionales que podrían ser útiles
    this.keywords = Array.isArray(data.keywords) ? data.keywords : [];
    this.citations = data.citations || null;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
  
  /**
   * Procesa y sanitiza el título
   * @private
   * @param {string} title - Título original
   * @returns {string} - Título procesado
   */
  _sanitizeTitle(title) {
    if (!title) return '';
    // Eliminar etiquetas HTML y decodificar entidades HTML básicas
    return title
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }
  
  /**
   * Procesa y normaliza la estructura de autores
   * @private
   * @param {Array|Object|string} authorsData - Datos de autores en diferentes formatos
   * @returns {Array} - Lista normalizada de autores
   */
  _processAuthors(authorsData) {
    // Si no hay datos, devolver array vacío
    if (!authorsData) return [];
    
    // Si ya es un array
    if (Array.isArray(authorsData)) {
      return authorsData.map(author => {
        // Si es un objeto con name
        if (author && typeof author === 'object' && author.name) {
          return {
            name: author.name,
            authtype: author.authtype || 'author'
          };
        }
        // Si es un string
        else if (typeof author === 'string') {
          return {
            name: author,
            authtype: 'author'
          };
        }
        // Formato desconocido
        return {
          name: String(author),
          authtype: 'author'
        };
      }).filter(author => author.name.trim() !== '');
    }
    
    // Si es un string (separado por comas)
    if (typeof authorsData === 'string') {
      return authorsData.split(',')
        .map(name => ({
          name: name.trim(),
          authtype: 'author'
        }))
        .filter(author => author.name !== '');
    }
    
    // Si es un objeto individual
    if (typeof authorsData === 'object' && authorsData !== null) {
      if (authorsData.name) {
        return [{
          name: authorsData.name,
          authtype: authorsData.authtype || 'author'
        }];
      }
    }
    
    return [];
  }
  
  /**
   * Genera una URL al artículo en PubMed basado en el PMID
   * @returns {string|null} - URL al artículo o null si no hay PMID
   */
  generatePubMedUrl() {
    return this.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${this.pmid}/` : null;
  }
  
  /**
   * Valida que el artículo tenga los campos mínimos necesarios
   * @returns {boolean} - true si el artículo es válido
   */
  isValid() {
    return Boolean(this.title && (this.pmid || this.doi));
  }
  
  /**
   * Valida que el artículo tenga los campos mínimos necesarios para ser analizado por Claude
   * @returns {boolean} - true si el artículo tiene suficiente información para análisis
   */
  validateForAnalysis() {
    // Verificar que hay un título significativo (no genérico)
    const hasValidTitle = this.title && this.title !== 'Sin título' && this.title.length > 5;
    
    // Verificar que hay un abstract con suficiente contenido
    const hasValidAbstract = this.abstract && this.abstract.length > 50 && this.abstract !== 'Abstract no disponible';
    
    // Verificar que tiene al menos un identificador
    const hasIdentifier = Boolean(this.pmid || this.doi);
    
    // Verificar que tiene fecha de publicación
    const hasPublicationDate = Boolean(this.publicationDate);
    
    // Resultado final: debe tener título, abstract e identificador
    return hasValidTitle && hasValidAbstract && hasIdentifier;
  }
  
  /**
   * Obtiene un resumen conciso del artículo
   * @returns {Object} - Resumen del artículo
   */
  getSummary() {
    return {
      pmid: this.pmid,
      title: this.title,
      authors: this.authors.map(author => author.name).join(', '),
      year: this.publicationDate ? new Date(this.publicationDate).getFullYear() : null,
      journal: this.journal,
      hasAnalysis: Boolean(this.secondaryAnalysis)
    };
  }
  
  /**
   * Convierte un objeto de respuesta de PubMed en un objeto Article
   * @param {Object} pubmedData - Datos de respuesta de PubMed
   * @returns {Article} - Instancia de Article
   */
  static fromPubMedData(pubmedData) {
    if (!pubmedData) return new Article({});
    
    return new Article({
      pmid: pubmedData.pmid,
      doi: pubmedData.articleids?.find(id => id.idtype === 'doi')?.value || null,
      title: pubmedData.title,
      authors: pubmedData.authors || [],
      publicationDate: pubmedData.pubdate,
      abstract: pubmedData.abstract,
      meshTerms: pubmedData.meshTerms || [],
      journal: pubmedData.source
    });
  }
  
  /**
   * Convierte una lista de artículos de PubMed en instancias de Article
   * @param {Array} pubmedDataList - Lista de datos de PubMed
   * @returns {Array<Article>} - Lista de instancias de Article
   */
  static fromPubMedList(pubmedDataList) {
    if (!Array.isArray(pubmedDataList)) {
      return [];
    }
    return pubmedDataList.map(data => Article.fromPubMedData(data));
  }
}

export default Article; 