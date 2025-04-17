/**
 * Prompts para IA (Claude) utilizados en la aplicación
 */

// Prompt para la búsqueda y construcción de estrategia bibliográfica
export const SEARCH_PROMPT = `Eres Claude, un asistente experto en investigación biomédica y estrategias bibliográficas.

Por favor, analiza la siguiente pregunta clínica y ayúdame a optimizar la búsqueda en PubMed:

Sigue estos pasos:
1. Identifica y extrae los componentes PICO (Población, Intervención, Comparador, Outcome) de la pregunta.
2. Traduce la pregunta y los conceptos clave al inglés de manera precisa para el contexto biomédico.
3. Genera una estrategia de búsqueda optimizada para PubMed que incluya:
   - Términos MeSH específicos y relevantes
   - Títulos y subtítulos relacionados
   - Operadores booleanos (AND, OR, NOT) utilizados adecuadamente
   - Sinónimos y variantes importantes de los conceptos clave

Asegúrate de que la estrategia sea completa pero precisa, para obtener resultados relevantes sin excesivo ruido.`;

// Prompt para el análisis secundario de cada estudio
export const ANALYSIS_PROMPT = `Eres Claude, un asistente experto en análisis crítico de literatura científica biomédica.

Analiza el siguiente artículo científico en relación a la pregunta clínica proporcionada:

Sigue estos pasos para tu análisis:
1. Identifica y describe claramente los elementos PICO del estudio (Población, Intervención, Comparador, Outcomes).
2. Evalúa críticamente los siguientes aspectos:
   - Calidad metodológica (diseño, tamaño de muestra, análisis estadístico)
   - Validez interna (control de sesgos, aleatorización, cegamiento)
   - Validez externa (aplicabilidad de los resultados a la población de interés)
   - Tipo de estudio (ensayo clínico, observacional, revisión sistemática, etc.)
3. Asigna una puntuación global del 1 al 5 sobre la calidad y relevancia del artículo para la pregunta clínica (donde 5 es excelente).
4. Justifica con argumentos claros y específicos por qué el estudio obtiene esa calificación, detallando sus fortalezas y debilidades principales.`;

// Función para generar el prompt de análisis completo con la información del artículo y la pregunta clínica
export const generateAnalysisPrompt = (article, clinicalQuestion) => {
  if (!article || !clinicalQuestion) return '';

  const { title, authors, abstract, publicationDate, doi, pmid, meshTerms } = article;
  
  const authorNames = authors && authors.length > 0 
    ? authors.map(author => author.name).join(", ")
    : "No disponible";
  
  const meshTermsText = meshTerms && meshTerms.length > 0
    ? meshTerms.join(", ")
    : "No disponible";

  return `${ANALYSIS_PROMPT}

Pregunta clínica: ${clinicalQuestion}

Información del artículo:
Título: ${title}
Autores: ${authorNames}
Fecha de publicación: ${publicationDate}
DOI: ${doi || 'No disponible'}
PMID: ${pmid || 'No disponible'}
Términos MeSH: ${meshTermsText}

Abstract: ${abstract}
`;
};

// Función para generar el prompt de búsqueda con la pregunta clínica
export const generateSearchPrompt = (clinicalQuestion) => {
  if (!clinicalQuestion) return '';
  
  return `${SEARCH_PROMPT}

Pregunta clínica: ${clinicalQuestion}
`;
};

/**
 * Genera un prompt para la síntesis de evidencia científica
 * @param {string} clinicalQuestion - Pregunta clínica
 * @param {Array} articles - Artículos con su análisis
 * @returns {string} - Prompt para generar una síntesis crítica
 */
export function generateSynthesisPrompt(clinicalQuestion, articles) {
  // Construir un resumen de cada artículo para incluirlo en el prompt
  const articlesInfo = articles.map((article, index) => {
    // Extraer datos esenciales del artículo
    const title = article.title || 'Sin título';
    const authors = typeof article.authors === 'string' 
      ? article.authors 
      : (Array.isArray(article.authors) ? article.authors.map(a => a.name || a).join(", ") : "");
    const pmid = article.pmid || `N/A-${index}`;
    const publicationDate = article.publicationDate || 'Fecha desconocida';
    const abstract = article.abstract || 'No disponible';
    const analysis = article.secondaryAnalysis || article.analysis || '';
    
    // Crear un resumen estructurado
    return `
ARTÍCULO ${pmid}:
Título: ${title}
Autores: ${authors}
Fecha: ${publicationDate}
PMID: ${pmid}
Abstract: ${abstract.substring(0, 300)}${abstract.length > 300 ? '...' : ''}
Análisis previo: ${analysis.substring(0, 500)}${analysis.length > 500 ? '...' : ''}
    `;
  }).join('\n\n');
  
  // Crear un prompt para la síntesis
  return `Eres Claude, un asistente experto en medicina basada en la evidencia y análisis crítico de literatura científica. 

Tu tarea es crear una síntesis crítica de la evidencia científica para responder a la siguiente pregunta clínica:

PREGUNTA CLÍNICA: "${clinicalQuestion}"

He analizado previamente varios artículos científicos relacionados con esta pregunta. A continuación te proporciono la información extraída de estos artículos, incluyendo títulos, autores, fechas, abstracts y un análisis previo de cada uno:

${articlesInfo}

INSTRUCCIONES PARA LA SÍNTESIS:

1. INTRODUCCIÓN:
   - Presenta brevemente la pregunta clínica y su relevancia
   - Menciona el número de artículos revisados y sus características generales (tipos de estudios, fechas, poblaciones)
   
2. CUERPO PRINCIPAL:
   - Organiza la evidencia por temas o hallazgos principales, no por artículo individual
   - Contrasta los resultados cuando haya discrepancias entre estudios
   - Destaca los acuerdos y desacuerdos entre autores
   - Evalúa críticamente la calidad metodológica de los estudios
   - Presenta los hallazgos de mayor a menor nivel de evidencia
   - Identifica posibles sesgos o limitaciones en el conjunto de la evidencia
   - Cita los artículos usando el formato (Autor principal et al., año)
   
3. CONCLUSIÓN:
   - Resume la respuesta a la pregunta clínica según la evidencia analizada
   - Indica el nivel de certeza/incertidumbre en las conclusiones
   - Menciona las limitaciones de la evidencia disponible
   - Sugiere áreas para investigación futura si es pertinente
   
4. FORMATO Y ESTILO:
   - Utiliza un lenguaje científico pero accesible
   - Estructura el texto con encabezados y párrafos claros
   - Incluye formato HTML para mejorar la legibilidad (títulos <h4>, párrafos <p>, etc.)
   - Crea una síntesis científica rigurosa pero concisa (aproximadamente 1000-1500 palabras)
   - Usa un tono académico pero directo
   
Genera una síntesis crítica completa en formato HTML, que evalúe objetivamente la evidencia disponible para responder a la pregunta clínica planteada.`;
} 