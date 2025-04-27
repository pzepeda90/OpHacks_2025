// Modelo para representar métricas iCite de un artículo
class ICiteMetrics {
  constructor(data = {}) {
    this.pmid = data.pmid || null;
    this.year = data.year || null;
    this.title = data.title || null;
    this.authors = data.authors || null;
    this.journal = data.journal || null;
    this.is_research_article = data.is_research_article || null;
    this.relative_citation_ratio = data.relative_citation_ratio || null;
    this.nih_percentile = data.nih_percentile || null;
    this.human = data.human || null;
    this.animal = data.animal || null;
    this.molecular_cellular = data.molecular_cellular || null;
    this.apt = data.apt || null;
    this.is_clinical = data.is_clinical || null;
    this.citation_count = data.citation_count || null;
    this.citations_per_year = data.citations_per_year || null;
    this.expected_citations_per_year = data.expected_citations_per_year || null;
    this.field_citation_rate = data.field_citation_rate || null;
    this.provisional = data.provisional || null;
    this.x_coord = data.x_coord || null;
    this.y_coord = data.y_coord || null;
    this.cited_by_clin = data.cited_by_clin || [];
    this.cited_by = data.cited_by || [];
    this.references = data.references || [];
    this.doi = data.doi || null;
    this.last_modified = data.last_modified || null;
  }

  static fromICiteResponse(data) {
    return new ICiteMetrics(data);
  }

  static fromICiteList(dataList) {
    if (!Array.isArray(dataList)) return [];
    return dataList.map(item => ICiteMetrics.fromICiteResponse(item));
  }
}

export default ICiteMetrics; 