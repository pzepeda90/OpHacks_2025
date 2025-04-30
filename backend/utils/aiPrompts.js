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
Abstract: ${abstract.substring(0, 200)}${abstract.length > 200 ? '...' : ''}
Análisis previo: ${analysis.substring(0, 300)}${analysis.length > 300 ? '...' : ''}
    `;
  }).join('\n\n');
  
  // Crear un prompt para la síntesis optimizado para ser más eficiente y contrastante
  return `Eres un experto en medicina basada en evidencia y meta-análisis. Crea una síntesis de la evidencia científica con enfoque meta-analítico y contraste de autores para responder:

PREGUNTA CLÍNICA: "${clinicalQuestion}"

INFORMACIÓN DE ARTÍCULOS:
${articlesInfo}

INSTRUCCIONES PARA META-ANÁLISIS (FORMATO CONCISO):

1. HETEROGENEIDAD:
   - Calcula e interpreta I² (<25% baja, 25-50% moderada, >50% alta)
   - Reporta Q de Cochran (con valor p)
   - Determina si es adecuado un meta-análisis

2. SÍNTESIS CUANTITATIVA:
   - Usa modelo de efectos aleatorios si hay heterogeneidad moderada/alta
   - Proporciona efectos combinados con IC 95%
   - Incluye pesos por estudio
   - Presenta datos para forest plot

3. ANÁLISIS CUALITATIVO CON CONTRASTE:
   - Organiza por temas, no por artículo
   - Contrasta explícitamente opiniones divergentes entre autores usando frases como "En contraste con X, el autor Y sostiene que..."
   - Identifica puntos de acuerdo y desacuerdo entre los estudios
   - Usa frases de transición como "Por otro lado...", "Sin embargo...", "A diferencia de..."
   - Evalúa con metodología GRADE
   - Cita con formato (Autor et al., año)

4. DEBATE DE EVIDENCIA:
   - Incluye una sección específica titulada "Controversias y debate" que presente diferentes posturas
   - Expone argumentos y contraargumentos entre los estudios
   - Evalúa críticamente las fortalezas y debilidades metodológicas que pueden explicar resultados contradictorios
   - Termina con conclusiones balanceadas que reconozcan la diversidad de opiniones

5. FORMATO HTML:
   - Usa este formato para heterogeneidad:
     <div class="heterogeneity-stats">
       <div class="heterogeneity-stat">
         <span class="stat-name">I²</span>
         <span class="stat-value">42%</span>
         <span class="stat-interpretation">Heterogeneidad moderada</span>
       </div>
       <div class="heterogeneity-stat">
         <span class="stat-name">Q de Cochran</span>
         <span class="stat-value">15.3 (p=0.084)</span>
       </div>
     </div>

   - Usa este formato para la tabla meta-analítica:
     <table class="meta-table">
       <tr><th>Estudio</th><th>Año</th><th>OR [IC 95%]</th><th>Peso</th></tr>
       <tr><td>Smith et al.</td><td>2023</td><td class="ci-value">1.75 [1.32-2.31]</td><td class="weight">45%</td></tr>
       <tr class="combined-effect"><td colspan="2">Efecto combinado</td><td class="ci-value">1.82 [1.45-2.28]</td><td class="weight">100%</td></tr>
     </table>

Genera una síntesis HTML concisa (max. 1500 palabras) con estadísticas de heterogeneidad, tabla meta-analítica, clara contraposición de opiniones entre autores y conclusiones balanceadas basadas en GRADE.`;
} 