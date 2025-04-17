import React from 'react';
import Card from '../Card/Card';
import './ResultsContainer.css';

const ResultsContainer = ({ searchStrategy, articles, loading }) => {
  // Contar artículos con análisis completo
  const fullyAnalyzedCount = articles.filter(article => article.fullyAnalyzed).length;
  const hasPartialAnalysis = articles.some(article => article.fullyAnalyzed === false);
  const hasAnalysis = fullyAnalyzedCount > 0 || hasPartialAnalysis;
  
  // Verificar si hay artículos priorizados
  const hasPrioritizedArticles = articles.some(article => article.priorityScore !== undefined);
  
  return (
    <div className="results-container">
      {loading ? (
        <div className="loading-results">
          <div className="loading-spinner"></div>
          <p>Buscando artículos y analizando resultados...</p>
        </div>
      ) : (
        <>
          {searchStrategy && (
            <div className="search-strategy">
              <h3>Estrategia de búsqueda</h3>
              <pre>{searchStrategy}</pre>
            </div>
          )}
          
          {articles.length > 0 ? (
            <>
              <div className="results-summary">
                <h2>Resultados ({articles.length})</h2>
                
                {hasPrioritizedArticles && (
                  <div className="priority-info">
                    <div className="priority-icon">🔍</div>
                    <div className="priority-message">
                      <p>
                        <strong>Artículos priorizados:</strong> Los resultados han sido ordenados según su relevancia para 
                        tu consulta. El sistema ha asignado una puntuación basada en el tipo de estudio, fecha de 
                        publicación, prestigio de la revista y relevancia del contenido.
                      </p>
                      {hasAnalysis && (
                        <p>
                          <strong>{fullyAnalyzedCount} estudio{fullyAnalyzedCount !== 1 ? 's' : ''}</strong> de mayor relevancia 
                          {fullyAnalyzedCount !== 1 ? ' han sido analizados' : ' ha sido analizado'} en detalle por IA. 
                          El resto se muestra con un análisis básico.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="results-list">
                {articles.map((article, index) => (
                  <Card key={article.pmid || index} article={article} />
                ))}
              </div>
            </>
          ) : (
            <div className="no-results">
              <p>No se encontraron artículos para esta consulta. Intenta modificar la estrategia de búsqueda.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ResultsContainer; 