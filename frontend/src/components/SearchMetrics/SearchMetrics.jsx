import React from 'react';
import './SearchMetrics.css';

/**
 * Componente para mostrar métricas de búsqueda
 * @param {Object} metrics - Métricas de búsqueda
 * @param {number} metrics.sensitivity - Sensibilidad de la búsqueda (0-100)
 * @param {number} metrics.specificity - Especificidad de la búsqueda (0-100)
 * @param {number} metrics.precision - Precisión de la búsqueda (0-100)
 * @param {number} metrics.nnr - Número necesario a leer
 * @returns {JSX.Element} - Componente de métricas
 */
const SearchMetrics = ({ metrics }) => {
  if (!metrics) return null;

  // Determinar el color para cada métrica
  const getColorClass = (value) => {
    if (value >= 80) return 'metric-excellent';
    if (value >= 60) return 'metric-good';
    if (value >= 40) return 'metric-average';
    if (value >= 20) return 'metric-fair';
    return 'metric-poor';
  };

  // Obtener texto descriptivo para NNR
  const getNnrDescription = (nnr) => {
    if (nnr <= 2) return 'Excelente';
    if (nnr <= 5) return 'Bueno';
    if (nnr <= 10) return 'Aceptable';
    if (nnr <= 20) return 'Limitado';
    return 'Pobre';
  };

  return (
    <div className="search-metrics">
      <h3 className="metrics-header">
        <i className="fas fa-chart-line"></i> Métricas de búsqueda
      </h3>
      
      <div className="metrics-container">
        <div className="metric-card">
          <div className="metric-title">Sensibilidad</div>
          <div className={`metric-value ${getColorClass(metrics.sensitivity)}`}>
            {metrics.sensitivity}%
          </div>
          <div className="metric-description">
            Capacidad para encontrar resultados relevantes
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-title">Especificidad</div>
          <div className={`metric-value ${getColorClass(metrics.specificity)}`}>
            {metrics.specificity}%
          </div>
          <div className="metric-description">
            Precisión en excluir resultados irrelevantes
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-title">Precisión</div>
          <div className={`metric-value ${getColorClass(metrics.precision)}`}>
            {metrics.precision}%
          </div>
          <div className="metric-description">
            Porcentaje de resultados relevantes
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-title">NNR</div>
          <div className={`metric-value ${getColorClass(100 - Math.min(metrics.nnr * 5, 100))}`}>
            {metrics.nnr} <span className="metric-quality">({getNnrDescription(metrics.nnr)})</span>
          </div>
          <div className="metric-description">
            Número necesario a leer para encontrar un artículo relevante
          </div>
        </div>
      </div>
      
      <div className="metrics-info">
        <i className="fas fa-info-circle"></i> Las métricas evalúan la calidad de la estrategia de búsqueda utilizada.
      </div>
    </div>
  );
};

export default SearchMetrics; 