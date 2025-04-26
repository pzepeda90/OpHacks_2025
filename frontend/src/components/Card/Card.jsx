import React, { useEffect } from "react";
import "./Card.css";

/**
 * Procesa la lista de autores para asegurar que se muestra correctamente
 * @param {Array|Object|string} authors - Datos de autores en diferentes formatos
 * @returns {string} - Texto formateado de autores
 */
const formatAuthors = (authors) => {
  if (!authors) return "Autores no disponibles";
  
  // Si ya es un string
  if (typeof authors === 'string') {
    return authors.trim() || "Autores no disponibles";
  }
  
  // Si es un array 
  if (Array.isArray(authors)) {
    // Si es array de objetos con propiedad name
    if (authors.length > 0 && typeof authors[0] === 'object' && authors[0] !== null) {
      const authorNames = authors
        .map(author => (author.name || author.fullName || '').trim())
        .filter(name => name !== '');
      
      return authorNames.length > 0 
        ? authorNames.join(", ") 
        : "Autores no disponibles";
    }
    
    // Si es array de strings
    if (authors.length > 0 && typeof authors[0] === 'string') {
      return authors.filter(a => a.trim() !== '').join(", ") || "Autores no disponibles";
    }
    
    // Intentar convertir a string cualquier valor
    const authorsString = authors
      .map(a => a ? String(a).trim() : '')
      .filter(a => a !== '')
      .join(", ");
      
    return authorsString || "Autores no disponibles";
  }
  
  // Si es un objeto individual, intentar extraer name
  if (typeof authors === 'object' && authors !== null) {
    return (authors.name || authors.fullName || "Autores no disponibles").trim();
  }
  
  return "Autores no disponibles";
};

/**
 * Procesamiento de títulos para asegurar que no sean genéricos
 * @param {string} title - Título original del artículo
 * @returns {string} - Título procesado
 */
const formatTitle = (title) => {
  if (!title) return "Sin título disponible";
  
  // Limpiar el título
  const cleanTitle = title.trim();
  
  // Verificar si es un título genérico o muy corto
  const genericTitles = [
    "retinal detachment", 
    "desprendimiento de retina", 
    "sin título", 
    "untitled", 
    "n/a"
  ];
  
  // Comprobar si coincide con alguno de los títulos genéricos (insensible a mayúsculas/minúsculas)
  const isGeneric = genericTitles.some(generic => 
    cleanTitle.toLowerCase() === generic.toLowerCase() || 
    cleanTitle.length < 5
  );
  
  // Si es genérico, proporcionar un texto más informativo
  if (isGeneric) {
    return "Título completo no disponible - Consulte el artículo original para más detalles";
  }
  
  return cleanTitle;
};

/**
 * Determina el tipo de estudio basado en el título y abstract
 * @param {string} title - Título del artículo
 * @param {string} abstract - Resumen del artículo
 * @returns {Object} - Tipo de estudio, clase CSS y nombre para mostrar
 */
const determineStudyType = (title, abstract) => {
  const titleLower = (title || '').toLowerCase();
  const abstractLower = (abstract || '').toLowerCase();
  const combinedText = titleLower + ' ' + abstractLower;
  
  // Tipos de estudio ordenados por jerarquía (los primeros tienen prioridad)
  const studyTypes = [
    {
      type: 'meta-analysis',
      class: 'study-meta-analysis',
      label: 'Meta-análisis',
      keywords: ['meta-analysis', 'metaanálisis', 'meta análisis', 'metaanalysis']
    },
    {
      type: 'systematic-review',
      class: 'study-systematic-review',
      label: 'Revisión sistemática',
      keywords: ['systematic review', 'revisión sistemática', 'systematic']
    },
    {
      type: 'rct',
      class: 'study-rct',
      label: 'Ensayo clínico aleatorizado',
      keywords: ['randomized', 'randomised', 'aleatorizado', 'rct', 'controlled trial', 'ensayo clínico']
    },
    {
      type: 'cohort',
      class: 'study-cohort',
      label: 'Estudio de cohorte',
      keywords: ['cohort', 'cohorte', 'longitudinal']
    },
    {
      type: 'case-control',
      class: 'study-case-control',
      label: 'Casos y controles',
      keywords: ['case-control', 'caso-control', 'casos y controles']
    },
    {
      type: 'case-series',
      class: 'study-case-series',
      label: 'Serie de casos',
      keywords: ['case series', 'serie de casos', 'case report', 'reporte de caso']
    },
    {
      type: 'review',
      class: 'study-review',
      label: 'Revisión',
      keywords: ['review', 'revisión', 'overview']
    }
  ];
  
  // Buscar coincidencias con palabras clave
  for (const studyType of studyTypes) {
    if (studyType.keywords.some(keyword => combinedText.includes(keyword))) {
      return studyType;
    }
  }
  
  // Si no hay coincidencias, devolver tipo desconocido
  return {
    type: 'unknown',
    class: 'study-unknown',
    label: 'Artículo'
  };
};

// Función para renderizar HTML de manera segura
const createMarkup = (html) => {
  return { __html: html };
};

/**
 * Formatea un valor numérico para mostrar con el número de decimales especificado
 * @param {number} value - Valor a formatear
 * @param {number} decimals - Número de decimales
 * @returns {string} - Valor formateado
 */
const formatNumber = (value, decimals = 2) => {
  if (value === undefined || value === null) return 'N/A';
  return typeof value === 'number' ? value.toFixed(decimals) : 'N/A';
};

/**
 * Renderiza un indicador de métrica con escala de colores
 * @param {string} label - Etiqueta de la métrica
 * @param {number|string} value - Valor de la métrica
 * @param {string} tooltip - Texto de ayuda
 * @param {number} max - Valor máximo para la escala
 * @returns {JSX.Element} - Elemento JSX
 */
const MetricIndicator = ({ label, value, tooltip, max = 100 }) => {
  // Determinar el color basado en el valor (0-100%)
  const percentage = typeof value === 'number' ? Math.min(value / max * 100, 100) : 0;
  const getColor = () => {
    if (percentage >= 80) return 'var(--metric-excellent)';
    if (percentage >= 60) return 'var(--metric-good)';
    if (percentage >= 40) return 'var(--metric-average)';
    if (percentage >= 20) return 'var(--metric-fair)';
    return 'var(--metric-poor)';
  };

  return (
    <div className="metric-indicator" title={tooltip}>
      <span className="metric-label">{label}:</span>
      <span className="metric-value" style={{ color: getColor() }}>
        {typeof value === 'number' ? formatNumber(value) : value}
      </span>
    </div>
  );
};

/**
 * Componente para mostrar las métricas de iCite
 * @param {Object} metrics - Métricas de iCite
 * @returns {JSX.Element} - Elemento JSX
 */
const ICiteMetrics = ({ metrics }) => {
  if (!metrics) return null;
  
  return (
    <div className="icite-metrics">
      <h4 className="metrics-title">Métricas de impacto</h4>
      <div className="metrics-grid">
        <MetricIndicator 
          label="RCR" 
          value={metrics.rcr} 
          tooltip="Relative Citation Ratio - Compara las citas con la media del campo" 
          max={5} 
        />
        <MetricIndicator 
          label="APT" 
          value={metrics.apt} 
          tooltip="Approximate Potential to Translate - Potencial de traslación clínica" 
          max={100} 
        />
        <MetricIndicator 
          label="Citas clínicas" 
          value={metrics.clinical_citations} 
          tooltip="Número de citas en artículos clínicos" 
          max={50} 
        />
        <MetricIndicator 
          label="Total citas" 
          value={metrics.citation_count} 
          tooltip="Número total de citas" 
          max={100} 
        />
      </div>
    </div>
  );
};

const Card = ({ article }) => {
  if (!article) {
    console.error("Se intentó renderizar Card sin datos de artículo");
    return <div className="article-card article-card-warning">Error: Datos de artículo no disponibles</div>;
  }

  // Asegurar que las propiedades existan para evitar errores
  const articleData = {
    publicationDate: article.publicationDate || "Fecha no disponible",
    doi: article.doi || null,
    pmid: article.pmid || `unknown-${Math.random().toString(36).substr(2, 9)}`,
    title: article.title || "Título no disponible",
    authors: article.authors || [],
    abstract: article.abstract || "Resumen no disponible",
    meshTerms: Array.isArray(article.meshTerms) ? article.meshTerms : [],
    priorityScore: typeof article.priorityScore === 'number' ? article.priorityScore : null,
    source: article.source || "Fuente no especificada",
    secondaryAnalysis: article.secondaryAnalysis || article.analysis?.content,
    iCiteMetrics: article.iCiteMetrics || null
  };

  // Usar las funciones de formateo para manejar diferentes casos
  const authorsList = formatAuthors(articleData.authors);
  const formattedTitle = formatTitle(articleData.title);

  // Determinar el tipo de estudio
  const studyType = determineStudyType(articleData.title, articleData.abstract);

  // Crear URL al artículo original en PubMed
  const pubmedUrl = articleData.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${articleData.pmid}/` : null;

  // Verificar si todos los datos son válidos
  const hasValidData = formattedTitle !== "Sin título disponible" && 
                      authorsList !== "Autores no disponibles" &&
                      articleData.abstract;

  // Verificar si el análisis contiene HTML con formato de tarjeta
  const hasCardFormat = articleData.secondaryAnalysis && 
    (articleData.secondaryAnalysis.includes('<div class="card-analysis">') || 
     articleData.secondaryAnalysis.includes('class="card-header"') ||
     articleData.secondaryAnalysis.includes('class="badges"'));

  useEffect(() => {
    // Función para aplicar colores personalizados a los badges de tipo
    const applyBadgeColors = () => {
      // Verificar si hay análisis secundario y buscar badges
      if (articleData.secondaryAnalysis && hasCardFormat) {
        // Esperar a que el DOM se actualice
        setTimeout(() => {
          // Seleccionar todos los badges de tipo dentro de esta tarjeta
          const typeBadges = document.querySelectorAll('.badge.type');
          
          if (typeBadges.length > 0) {
            typeBadges.forEach(badge => {
              const text = badge.textContent.toLowerCase();
              
              if (text.includes('meta-análisis') || text.includes('metaanálisis')) {
                badge.style.backgroundColor = '#8e44ad';
                badge.style.color = 'white';
              } else if (text.includes('revisión sistemática') || text.includes('revision sistematica')) {
                badge.style.backgroundColor = '#9b59b6';
                badge.style.color = 'white';
              } else if (text.includes('ensayo clínico') || text.includes('aleatorizado') || text.includes('eca')) {
                badge.style.backgroundColor = '#3498db';
                badge.style.color = 'white';
              } else if (text.includes('cohorte')) {
                badge.style.backgroundColor = '#2ecc71';
                badge.style.color = 'white';
              } else if (text.includes('casos y controles') || text.includes('caso-control')) {
                badge.style.backgroundColor = '#f39c12';
                badge.style.color = 'white';
              } else if (text.includes('serie de casos') || text.includes('reporte de caso')) {
                badge.style.backgroundColor = '#e67e22';
                badge.style.color = 'white';
              } else if (text.includes('revisión') || text.includes('revision')) {
                badge.style.backgroundColor = '#16a085';
                badge.style.color = 'white';
              } else {
                badge.style.backgroundColor = '#7f8c8d';
                badge.style.color = 'white';
              }
            });
          }
        }, 100);
      }
    };
    
    applyBadgeColors();
  }, [articleData.secondaryAnalysis, hasCardFormat]);

  return (
    <div className={`article-card ${!hasValidData ? 'article-card-warning' : ''}`}>
      {/* Mostrar badge de tipo de estudio */}
      <div className="study-type-badge">
        <span className={studyType.class}>{studyType.label}</span>
      </div>
      
      {/* Mostrar badge de prioridad si existe */}
      {articleData.priorityScore !== undefined && (
        <div className="priority-badge">
          <div className="priority-badge-inner">
            <span className="score-value">{articleData.priorityScore}</span>
            <span className="score-label">relevancia</span>
          </div>
        </div>
      )}
      
      <div className="article-header">
        <h2 className="article-title">{formattedTitle}</h2>
        <p className="article-authors">{authorsList}</p>
        <div className="article-meta">
          <span className="meta-item">
            <span className="meta-label">Fecha:</span> {articleData.publicationDate}
          </span>
          {articleData.source && (
            <span className="meta-item">
              <span className="meta-label">Fuente:</span> {articleData.source}
            </span>
          )}
          {articleData.doi && (
            <span className="meta-item">
              <span className="meta-label">DOI:</span> {articleData.doi}
            </span>
          )}
          {articleData.pmid && (
            <span className="meta-item">
              <span className="meta-label">PMID:</span> {articleData.pmid}
            </span>
          )}
        </div>
      </div>

      <div className="article-body">
        <div className="article-section">
          <h3 className="section-title">Abstract</h3>
          <p className="abstract-content">{articleData.abstract || "Abstract no disponible"}</p>
        </div>

        {articleData.meshTerms && articleData.meshTerms.length > 0 && (
          <div className="article-section">
            <h3 className="section-title">Términos MeSH</h3>
            <div className="mesh-terms">
              {articleData.meshTerms.map((term, index) => (
                <span key={index} className="mesh-term">
                  {term}
                </span>
              ))}
            </div>
          </div>
        )}

        {articleData.secondaryAnalysis && (
          <div className={`article-section secondary-analysis`}>
            <div className="analysis-header">
              <h3 className="section-title">Análisis con IA</h3>
            </div>
            
            <div className="analysis-content">
              {articleData.secondaryAnalysis.split('\n').map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
          </div>
        )}
      </div>

      {pubmedUrl && (
        <div className="article-footer">
          <a 
            href={pubmedUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="pubmed-link"
          >
            Ver artículo original en PubMed
          </a>
        </div>
      )}

      {/* Métrica de iCite */}
      {articleData.iCiteMetrics && <ICiteMetrics metrics={articleData.iCiteMetrics} />}
    </div>
  );
};

export default Card; 