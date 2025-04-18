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
      ) : articles.length > 0 ? (
        <>
          {/* Alerta de descargo de responsabilidad médica */}
          <div className="medical-disclaimer">
            <div className="disclaimer-icon">⚠️</div>
            <div className="disclaimer-content">
              <h4>Aviso importante</h4>
              <p>La IA puede cometer errores. Esta información no reemplaza una consulta médica ni el criterio médico profesional. Esta herramienta fue creada para ser un apoyo clínico al quehacer de los profesionales de la salud.</p>
            </div>
          </div>

          {searchStrategy && (
            <div className="search-strategy">
              <h3>Estrategia de búsqueda generada:</h3>
              <pre>{searchStrategy}</pre>
            </div>
          )}
          
          {hasPrioritizedArticles && (
            <div className="priority-info">
              <div className="priority-icon">ℹ️</div>
              <div className="priority-message">
                <p>Los artículos han sido priorizados basados en su relevancia para su consulta, considerando:</p>
                <p>- Nivel de evidencia científica (meta-análisis, revisiones sistemáticas, etc.)</p>
                <p>- Actualidad de los estudios</p>
                <p>- Relevancia temática para su pregunta</p>
                {hasAnalysis && <p>- Se ha realizado un análisis detallado de los artículos más relevantes</p>}
              </div>
            </div>
          )}
          
          <div className="results-list">
            {articles.map((article) => (
              <Card key={article.pmid} article={article} />
            ))}
          </div>
        </>
      ) : (
        <div className="no-results">
          <p>No se encontraron artículos científicos para su consulta.</p>
          <p>Sugerencias:</p>
          <ul>
            <li>Intente utilizar términos más generales</li>
            <li>Verifique la ortografía de los términos</li>
            <li>Pruebe con sinónimos de los términos médicos</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default ResultsContainer; 