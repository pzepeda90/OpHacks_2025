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
  analyzeArticle: jest.fn()
    .mockImplementation(async (article, question) => {
      // Implementación por defecto
      return 'Análisis detallado del artículo';
    }),
  generateResponse: jest.fn().mockResolvedValue('Respuesta generada por Claude'),
  filterByTitles: jest.fn().mockImplementation(articles => {
    // Devolver los dos primeros artículos como filtrados
    return articles.slice(0, 2);
  }),
  filterTitlesByRelevance: jest.fn().mockImplementation(articles => articles),
  analyzeArticleBatch: jest.fn()
    .mockImplementation(async (articles, question) => {
      // Por defecto, retorna artículos analizados
      return articles.map((article, index) => ({
        ...article,
        secondaryAnalysis: `Análisis del artículo ${index + 1}`,
        analyzed: true
      }));
    }),
  generateSynthesis: jest.fn().mockResolvedValue('Síntesis de la evidencia científica'),
  // Métodos específicos para probar el manejo de rate limit
  handleRateLimit: jest.fn().mockImplementation(async (error, retryFn) => {
    // Simula el manejo de rate limit con reintento
    if (error.message && error.message.includes('rate limit')) {
      // Simular espera y reintentar
      return await retryFn();
    }
    throw error;
  }),
  retryWithExponentialBackoff: jest.fn().mockImplementation(async (fn, maxRetries = 3) => {
    // Simula el algoritmo de backoff exponencial
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        // Si no es el último intento y es un error de rate limit, continuar
        if (attempt < maxRetries - 1 && error.message && 
            (error.message.includes('rate limit') || error.message.includes('429'))) {
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  })
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