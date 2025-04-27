// Modelo para representar datos de iCite
class ICite {
  /**
   * Crea una nueva instancia de ICite a partir de datos de la API de iCite
   * @param {Object} data - Datos de la API de iCite
   */
  constructor(data) {
    if (!data) data = {};
    this.pmid = data.pmid || null;
    this.year = data.year || null;
    this.title = data.title || '';
    this.authors = data.authors || '';
    this.journal = data.journal || '';
    this.is_research_article = data.is_research_article || '';
    this.relative_citation_ratio = data.relative_citation_ratio || null;
    this.nih_percentile = data.nih_percentile || null;
    this.human = data.human || null;
    this.animal = data.animal || null;
    this.molecular_cellular = data.molecular_cellular || null;
    this.apt = data.apt || null;
    this.is_clinical = data.is_clinical || '';
    this.citation_count = data.citation_count || null;
    this.citations_per_year = data.citations_per_year || null;
    this.expected_citations_per_year = data.expected_citations_per_year || null;
    this.field_citation_rate = data.field_citation_rate || null;
    this.provisional = data.provisional || '';
    this.x_coord = data.x_coord || null;
    this.y_coord = data.y_coord || null;
    this.cited_by_clin = Array.isArray(data.cited_by_clin) ? data.cited_by_clin : [];
    this.cited_by = Array.isArray(data.cited_by) ? data.cited_by : [];
    this.references = Array.isArray(data.references) ? data.references : [];
    this.doi = data.doi || '';
    this.last_modified = data.last_modified || '';
  }

  /**
   * Devuelve un resumen del artículo iCite
   * @returns {Object}
   */
  getSummary() {
    return {
      pmid: this.pmid,
      year: this.year,
      title: this.title,
      authors: this.authors,
      journal: this.journal,
      relative_citation_ratio: this.relative_citation_ratio,
      citation_count: this.citation_count
    };
  }
}

export default ICite; 