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

const Card = ({ article }) => {
  const {
    publicationDate,
    doi,
    pmid,
    title,
    authors,
    abstract,
    meshTerms,
    secondaryAnalysis,
    fullyAnalyzed,
    priorityScore,
    analysisError,
    journal
  } = article;

  // Usar las funciones de formateo para manejar diferentes casos
  const authorsList = formatAuthors(authors);
  const formattedTitle = formatTitle(title);

  // Determinar el tipo de estudio
  const studyType = determineStudyType(title, abstract);

  // Crear URL al artículo original en PubMed
  const pubmedUrl = pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : null;

  // Verificar si todos los datos son válidos
  const hasValidData = formattedTitle !== "Sin título disponible" && 
                      authorsList !== "Autores no disponibles" &&
                      abstract;

  // Verificar si el análisis contiene HTML con formato de tarjeta
  const hasCardFormat = secondaryAnalysis && 
    (secondaryAnalysis.includes('<div class="card-analysis">') || 
     secondaryAnalysis.includes('class="card-header"') ||
     secondaryAnalysis.includes('class="badges"'));

  useEffect(() => {
    // Función para aplicar colores personalizados a los badges de tipo
    const applyBadgeColors = () => {
      // Verificar si hay análisis secundario y buscar badges
      if (secondaryAnalysis && hasCardFormat) {
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
  }, [secondaryAnalysis, hasCardFormat]);

  return (
    <div className={`article-card ${!hasValidData ? 'article-card-warning' : ''} ${fullyAnalyzed ? 'article-fully-analyzed' : 'article-partially-analyzed'}`}>
      {/* Mostrar badge de tipo de estudio */}
      <div className="study-type-badge">
        <span className={studyType.class}>{studyType.label}</span>
      </div>
      
      {/* Mostrar badge de prioridad si existe */}
      {priorityScore !== undefined && (
        <div className="priority-badge">
          <div className="priority-badge-inner">
            <span className="score-value">{priorityScore}</span>
            <span className="score-label">relevancia</span>
          </div>
        </div>
      )}
      
      <div className="article-header">
        <h2 className="article-title">{formattedTitle}</h2>
        <p className="article-authors">{authorsList}</p>
        <div className="article-meta">
          <span className="meta-item">
            <span className="meta-label">Fecha:</span> {publicationDate || "No disponible"}
          </span>
          {journal && (
            <span className="meta-item">
              <span className="meta-label">Revista:</span> {journal}
            </span>
          )}
          {doi && (
            <span className="meta-item">
              <span className="meta-label">DOI:</span> {doi}
            </span>
          )}
          {pmid && (
            <span className="meta-item">
              <span className="meta-label">PMID:</span> {pmid}
            </span>
          )}
        </div>
      </div>

      <div className="article-body">
        <div className="article-section">
          <h3 className="section-title">Abstract</h3>
          <p className="abstract-content">{abstract || "Abstract no disponible"}</p>
        </div>

        {meshTerms && meshTerms.length > 0 && (
          <div className="article-section">
            <h3 className="section-title">Términos MeSH</h3>
            <div className="mesh-terms">
              {meshTerms.map((term, index) => (
                <span key={index} className="mesh-term">
                  {term}
                </span>
              ))}
            </div>
          </div>
        )}

        {secondaryAnalysis && (
          <div className={`article-section secondary-analysis ${fullyAnalyzed ? 'analysis-complete' : 'analysis-summary'}`}>
            <div className="analysis-header">
              <h3 className="section-title">Análisis con IA</h3>
              {fullyAnalyzed !== undefined && (
                <div className="analysis-badge">
                  {fullyAnalyzed ? 
                    <span className="complete-analysis">Análisis detallado</span> : 
                    <span className="partial-analysis">Análisis básico</span>
                  }
                </div>
              )}
            </div>
            
            <div className="analysis-content">
              {analysisError ? (
                <div className="analysis-error">
                  <p>Ocurrió un error durante el análisis. {secondaryAnalysis}</p>
                </div>
              ) : hasCardFormat ? (
                // Renderizar HTML si tiene formato de tarjeta
                <div dangerouslySetInnerHTML={createMarkup(secondaryAnalysis)} />
              ) : (
                // Renderizar como texto normal
                secondaryAnalysis.split('\n').map((line, index) => (
                  <p key={index}>{line}</p>
                ))
              )}
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
    </div>
  );
};

export default Card; 