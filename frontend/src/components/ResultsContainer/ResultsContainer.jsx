import React from 'react';
import Card from '../Card';
import Loading from '../Loading';
import './ResultsContainer.css';

const ResultsContainer = ({ articles = [], loading, error }) => {
  console.log('ResultsContainer renderizando con:', { 
    artículos: articles?.length || 0, 
    cargando: loading,
    tieneError: !!error
  });
  
  if (Array.isArray(articles) && articles.length > 0) {
    console.log('Primer artículo:', JSON.stringify(articles[0]?.title || 'No título disponible').substring(0, 50));
  }

  return (
    <div className="results-container">
      {loading && (
        <div className="loading-container">
          <Loading text="Cargando artículos científicos..." />
        </div>
      )}

      {!loading && error && (
        <div className="error-container">
          <h3>Error al cargar resultados</h3>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && Array.isArray(articles) && articles.length === 0 && (
        <div className="no-results">
          <h3>No se encontraron artículos científicos para su consulta</h3>
          <p>Intente reformular su pregunta o utilizar términos más específicos.</p>
        </div>
      )}

      {!loading && !error && Array.isArray(articles) && articles.length > 0 && (
        <div className="articles-grid">
          {articles.map((article) => (
            <Card 
              key={article.pmid || `article-${Math.random().toString(36).substring(2)}`} 
              article={article} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ResultsContainer; 