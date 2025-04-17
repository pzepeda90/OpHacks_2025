import React from 'react';
import './Banner.css';

/**
 * Componente que muestra un banner informativo en la parte superior de la aplicación
 */
const Banner = () => {
  return (
    <div className="app-banner">
      <h1 className="app-title">Metanálisis Médico</h1>
      <p className="app-description">
        Encuentra y analiza literatura científica médica mediante 
        inteligencia artificial para dar soporte a tus investigaciones.
      </p>
      <div className="search-tips">
        <h3>Consejos de búsqueda:</h3>
        <ul>
          <li>Utiliza preguntas clínicas específicas para obtener mejores resultados</li>
          <li>La función de IA generará automáticamente estrategias de búsqueda optimizadas</li>
          <li>
            <strong>Nota:</strong> Las estrategias generadas son de alta precisión y específicas para cada pregunta clínica.
            Si deseas modificarlas, puedes hacerlo directamente en el campo de búsqueda.
          </li>
          <li>
            Para obtener resultados óptimos, revisa la estrategia generada y realiza ajustes si es necesario.
            PubMed puede encontrar cientos de artículos relevantes con una buena estrategia.
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Banner; 