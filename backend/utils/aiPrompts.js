/**
 * Utilidades para generar prompts para la IA
 */

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