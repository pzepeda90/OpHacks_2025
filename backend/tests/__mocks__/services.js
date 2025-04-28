// Mocks manuales para los servicios
import { jest } from '@jest/globals';

export const pubmedServiceMock = {
  search: jest.fn().mockResolvedValue([
    {
      pmid: '12345',
      title: 'Artículo de prueba',
      abstract: 'Resumen del artículo de prueba',
      authors: 'Autor de Prueba',
      publicationDate: '2023-01-01'
    }
  ]),
  getArticleByPmid: jest.fn().mockResolvedValue({
    pmid: '12345',
    title: 'Artículo de prueba',
    abstract: 'Resumen del artículo de prueba',
    authors: 'Autor de Prueba',
    publicationDate: '2023-01-01'
  }),
  getAbstractsForArticles: jest.fn().mockImplementation(articles => 
    articles.map(article => ({
      ...article,
      abstract: 'Abstract recuperado',
      hasAbstract: true
    }))
  )
};

export const claudeServiceMock = {
  generateSearchStrategy: jest.fn().mockResolvedValue({
    strategy: '("Test"[Mesh] AND "Strategy"[tiab])',
    fullResponse: 'Estrategia completa generada por Claude'
  }),
  analyzeArticle: jest.fn().mockResolvedValue('Análisis detallado del artículo'),
  generateResponse: jest.fn().mockResolvedValue('Respuesta generada por Claude'),
  filterByTitles: jest.fn().mockImplementation(articles => {
    // Devolver los dos primeros artículos como filtrados
    return articles.slice(0, 2);
  }),
  filterTitlesByRelevance: jest.fn().mockImplementation(articles => articles),
  analyzeArticleBatch: jest.fn().mockResolvedValue([
    {
      pmid: '12345',
      title: 'Artículo 1',
      secondaryAnalysis: 'Análisis del artículo 1'
    },
    {
      pmid: '67890',
      title: 'Artículo 2',
      secondaryAnalysis: 'Análisis del artículo 2'
    }
  ]),
  generateSynthesis: jest.fn().mockResolvedValue('Síntesis de la evidencia científica')
};

export const iciteServiceMock = {
  getByPmids: jest.fn().mockImplementation((pmids) => {
    if (Array.isArray(pmids)) {
      return Promise.resolve(pmids.map(pmid => ({
        pmid,
        title: `Artículo ${pmid}`,
        year: '2023',
        authors: 'Autor de Prueba',
        journal: 'Revista de Medicina',
        relative_citation_ratio: 1.5,
        nih_percentile: 75,
        citation_count: 10,
        citations_per_year: 5,
        expected_citations_per_year: 3.3,
        field_citation_rate: 2.2
      })));
    } else {
      return Promise.resolve({
        pmid: pmids,
        title: `Artículo ${pmids}`,
        year: '2023',
        authors: 'Autor de Prueba',
        journal: 'Revista de Medicina',
        relative_citation_ratio: 1.5,
        nih_percentile: 75,
        citation_count: 10,
        citations_per_year: 5,
        expected_citations_per_year: 3.3,
        field_citation_rate: 2.2
      });
    }
  })
}; 