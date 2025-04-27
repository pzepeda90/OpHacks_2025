/**
 * Servicio para interactuar con la API de Claude (Anthropic)
 * Usa axios directamente para comunicarse con la API
 */
import axios from 'axios';
import config from '../config/index.js';
import { generateSynthesisPrompt } from '../utils/aiPrompts.js';

/**
 * Función para registro de información con timestamp
 * @param {string} method - Método que genera el log
 * @param {string} message - Mensaje a registrar
 * @param {Object} data - Datos adicionales (opcional)
 */
function logInfo(method, message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [Claude] [${method}] ${message}`);
  if (data) {
    console.log(`[${timestamp}] [Claude] [${method}] Datos:`, 
      typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  }
}

/**
 * Función para registro de errores con timestamp
 * @param {string} method - Método que genera el error
 * @param {string} message - Mensaje de error
 * @param {Error} error - Objeto de error (opcional)
 */
function logError(method, message, error = null) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [Claude] [${method}] ERROR: ${message}`);
  if (error) {
    console.error(`[${timestamp}] [Claude] [${method}] Detalles:`, error);
  }
}

class ClaudeService {
  constructor() {
    this.apiKey = config.apis.claude.apiKey;
    
    // La URL base para la API de Claude
    this.baseUrl = 'https://api.anthropic.com';
    
    // Usar el modelo Claude Haiku como modelo principal
    this.modelName = 'claude-3-haiku-20240307';
    
    logInfo('constructor', `Servicio Claude inicializado para modelo: ${this.modelName}`);
    if (!this.apiKey) {
      logError('constructor', 'API Key de Claude no configurada');
    }
  }

  /**
   * Genera una respuesta basada en un prompt utilizando Claude
   * @param {string} prompt - El prompt para Claude
   * @param {Object} options - Opciones adicionales
   * @param {string} options.specificModel - Modelo específico a usar (opcional)
   * @param {number} options.temperature - Temperatura para la generación (opcional)
   * @returns {Promise<string>} - Respuesta generada
   */
  async generateResponse(prompt, options = {}) {
    const method = 'generateResponse';
    
    if (!prompt) {
      const error = new Error('Se requiere un prompt');
      logError(method, error.message);
      throw error;
    }

    if (!this.apiKey) {
      const error = new Error('API Key de Claude no está configurada');
      logError(method, error.message);
      throw error;
    }

    // Usar el modelo especificado o el predeterminado
    const modelToUse = options.specificModel || this.modelName;
    const temperature = options.temperature || 0.7;
    
    logInfo(method, `Iniciando generación con Claude usando modelo: ${modelToUse}`);
    logInfo(method, `Longitud del prompt: ${prompt.length} caracteres`);
    logInfo(method, `Temperatura configurada: ${temperature}`);
    
    const startTime = Date.now();
    
    try {
      // Estructura de la solicitud para Claude (Anthropic)
      const requestData = {
        model: modelToUse,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: temperature,
        max_tokens: 2048
      };
      
      // Endpoint de generación de texto de Claude
      const url = `${this.baseUrl}/v1/messages`;
      
      logInfo(method, `Enviando solicitud a ${url}`);
      
      // Aumentar el tiempo de espera a 45 segundos
      const response = await axios.post(url, requestData, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        timeout: 45000 // 45 segundos de timeout
      });
      
      const endTime = Date.now();
      const durationMs = endTime - startTime;
      
      logInfo(method, `Respuesta recibida después de ${durationMs}ms`);
      
      if (response.data && 
          response.data.content && 
          response.data.content.length > 0 && 
          response.data.content[0].text) {
        
        const responseText = response.data.content[0].text;
        logInfo(method, `Respuesta exitosa. Longitud: ${responseText.length} caracteres`);
        
        // Registrar algunos metadatos adicionales si están disponibles
        if (response.data.usage) {
          logInfo(method, `Uso de tokens: ${JSON.stringify(response.data.usage)}`);
        }
        
        return responseText;
      } else {
        const error = new Error('Formato de respuesta inválido de Claude');
        logError(method, error.message, response.data);
        throw error;
      }
    } catch (error) {
      const endTime = Date.now();
      const durationMs = endTime - startTime;
      
      // Mensajes de error más específicos según el tipo de error
      let errorMessage = `Error después de ${durationMs}ms: `;
      
      if (error.code === 'ECONNABORTED') {
        errorMessage += 'Tiempo de espera agotado. La API tardó demasiado en responder.';
      } else if (error.response && error.response.status === 429) {
        errorMessage += 'Demasiadas solicitudes. Se ha superado el límite de rate limit de la API.';
      } else if (error.response && error.response.status === 500) {
        errorMessage += 'Error interno del servidor de Claude. Intente nuevamente más tarde.';
      } else if (error.response && error.response.status === 503) {
        errorMessage += 'Servicio no disponible. La API de Claude puede estar experimentando problemas.';
      } else {
        errorMessage += error.message;
      }
      
      logError(method, errorMessage, error);
      
      // Mostrar información detallada del error
      if (error.response) {
        logError(method, `Estado HTTP: ${error.response.status}`, {
          status: error.response.status,
          data: error.response.data
        });
      }
      
      // Propagar el error con mensaje mejorado
      throw new Error(errorMessage);
    }
  }
  
  /**
   * Genera una estrategia de búsqueda para PubMed basada en una pregunta clínica
   * @param {string} clinicalQuestion - Pregunta clínica
   * @returns {Promise<string>} - Estrategia de búsqueda generada
   */
  async generateSearchStrategy(clinicalQuestion) {
    const method = 'generateSearchStrategy';
    
    if (!clinicalQuestion) {
      const error = new Error('Se requiere una pregunta clínica');
      logError(method, error.message);
      throw error;
    }
    
    logInfo(method, `Generando estrategia para pregunta: "${clinicalQuestion.substring(0, 100)}${clinicalQuestion.length > 100 ? '...' : ''}"`);
    
    // Prompt mejorado para generar estrategia de búsqueda más efectiva
    const prompt = `Eres Claude, un asistente experto en investigación biomédica, bibliometría y estrategias avanzadas de búsqueda de literatura científica.

Por favor, analiza la siguiente pregunta clínica y desarrolla una estrategia de búsqueda óptima para PubMed que maximice tanto la sensibilidad como la especificidad.

INSTRUCCIONES DETALLADAS:

1. ANÁLISIS INICIAL:
   - Identifica y extrae los componentes PICO (Población, Intervención, Comparador, Outcome) de la pregunta.
   - Traduce la pregunta y los conceptos clave al inglés de manera precisa para el contexto biomédico.
   - Identifica los términos más importantes y conceptos secundarios relevantes.

2. DESARROLLO DE TÉRMINOS:
   - Para cada concepto clave, lista:
     a) Términos MeSH exactos (con sus códigos si es posible)
     b) Términos de entrada (entry terms) relacionados
     c) Sinónimos importantes no cubiertos por MeSH
     d) Variantes terminológicas (incluidas abreviaturas médicas estándar)
     e) Términos más amplios y más específicos cuando sea relevante

3. ESTRUCTURA DE BÚSQUEDA:
   - Agrupa términos relacionados con operadores OR
   - Conecta diferentes conceptos con operadores AND
   - Utiliza NOT solo cuando sea absolutamente necesario para excluir resultados irrelevantes
   - Implementa búsquedas por campo específico cuando sea apropiado:
     * [MeSH] para términos del tesauro médico
     * [Title/Abstract] o [tiab] para palabras clave en título o resumen
     * [Majr] para términos MeSH como tema principal
     * [tw] para búsqueda en text words
     * [Publication Type] para filtrar por tipo de estudio si es relevante
     * [Subheading] para subtítulos MeSH específicos

4. ESTRUCTURA DE LA RESPUESTA:
   Tu respuesta debe incluir:
   
   a) ANÁLISIS PICO:
      - P: [Población identificada]
      - I: [Intervención identificada]
      - C: [Comparador identificado (si aplica)]
      - O: [Outcomes/resultados identificados]
   
   b) TRADUCCIÓN:
      - Traducción precisa al inglés de los términos clave
   
   c) MAPA CONCEPTUAL:
      - Lista de términos MeSH principales para cada concepto
      - Términos de entrada y sinónimos importantes
   
   d) ESTRATEGIA DE BÚSQUEDA COMPLETA:
      - Presenta la estrategia de búsqueda final con formato adecuado para copiar directamente en PubMed
      - Usa paréntesis para agrupar términos correctamente
      - Incluye combinaciones booleanas (AND, OR, NOT) apropiadas
   
   e) JUSTIFICACIÓN:
      - Breve explicación de por qué esta estrategia optimiza sensibilidad y especificidad

5. FORMATO FINAL:
   Asegúrate de que la estrategia final esté correctamente estructurada con:
   - Paréntesis balanceados y adecuadamente anidados
   - Operadores booleanos en mayúsculas (AND, OR, NOT)
   - Términos MeSH con el formato correcto (incluyendo [MeSH])
   - Subtítulos MeSH cuando sea apropiado (ej: "Diabetes Mellitus/therapy"[MeSH])

6. EJEMPLOS DE ESTRATEGIAS DE BÚSQUEDA EFECTIVAS:
   
   Ejemplo 1:
   Pregunta: ¿Qué evidencia existe sobre el uso de metotrexato para la prevención de redesprendimiento de retina o la disminución de proliferación vitreoretinal?
   Estrategia de búsqueda:
   ("Retinal Detachment"[Mesh] OR "recurrent retinal detachment"[tw] OR "retina redetachment"[tw]) 
   AND ("Methotrexate"[Mesh] OR "methotrexate"[tw] OR "MTX"[tw]) 
   AND ("Proliferative Vitreoretinopathy"[Mesh] OR "proliferation vitreoretinal"[tw] OR "PVR"[tw]) 
   AND ("Prevention"[Mesh] OR "reduce"[tw] OR "control"[tw] OR "prophylaxis"[tw])
   Resultado: 7 artículos altamente relevantes
   
   Ejemplo 2:
   Pregunta: ¿Cuáles son los factores de riesgo para que progrese la miopía en niños?
   Estrategia de búsqueda:
   ("Myopia/epidemiology"[Mesh] OR "myopia progression"[tiab]) 
   AND ("Risk Factors"[Majr] OR "predictive factors"[tiab]) 
   AND ("Child"[Mesh] OR "children"[tiab] OR "school-age"[tiab]) 
   AND ("outdoor time"[tiab] OR "outdoor activity"[tiab] OR "near work"[tiab] OR "genetic factors"[tiab] OR "parental myopia"[tiab] OR "screen time"[tiab] OR "educational level"[tiab] OR "axial length"[tiab] OR "refractive error"[tiab] OR "digital device use"[tiab])
   Resultado: 11 artículos altamente relevantes
   
   Ejemplo 3:
   Pregunta: ¿Cuál es la probabilidad de falla primaria de los trasplantes de córnea?
   Estrategia de búsqueda:
   ("Corneal Transplantation"[Mesh] OR "keratoplasty"[tiab]) 
   AND ("Primary Failure"[tiab] OR "Primary Graft Failure"[tiab] OR "PGF"[tiab] OR "early graft failure"[tiab]) 
   AND ("incidence"[tiab] OR "prevalence"[tiab] OR "rate"[tiab] OR "risk"[tiab])
   Resultado: 144 artículos altamente relevantes

Pregunta clínica: ${clinicalQuestion}`;

    try {
      logInfo(method, 'Enviando prompt estructurado a Claude para generar estrategia de búsqueda');
      const startTime = Date.now();
      const response = await this.generateResponse(prompt);
      const endTime = Date.now();
      logInfo(method, `Estrategia de búsqueda generada exitosamente en ${endTime - startTime}ms`);
      
      // Intenta extraer la estrategia de búsqueda final para facilitar su uso
      let extractedStrategy = null;
      
      // Método 1: Buscar sección "ESTRATEGIA DE BÚSQUEDA COMPLETA"
      const searchStrategyMatch = response.match(/ESTRATEGIA DE BÚSQUEDA COMPLETA:[\s\S]*?(\(.+?\)(?:\s+(?:AND|OR|NOT)\s+\(.+?\))*)/i);
      if (searchStrategyMatch && searchStrategyMatch[1]) {
        extractedStrategy = searchStrategyMatch[1].trim();
        logInfo(method, `Estrategia extraída (método 1): "${extractedStrategy.substring(0, 100)}${extractedStrategy.length > 100 ? '...' : ''}"`);
      } 
      // Método 2: Buscar secuencia de términos MeSH y operadores booleanos
      else {
        try {
          // Buscar un patrón que incluya términos MeSH y operadores booleanos
          const meshPattern = /\(\s*"[^"]+"\s*(?:\[[^\]]+\])(?:\s+OR\s+(?:"[^"]+"\s*(?:\[[^\]]+\])))*\)(?:\s+AND\s+\(.+?\))*/g;
          const matches = [...response.matchAll(meshPattern)];
          
          if (matches && matches.length > 0) {
            // Encontrar la coincidencia más larga (probablemente la estrategia completa)
            const longestMatch = matches.reduce((longest, match) => 
              match[0].length > longest.length ? match[0] : longest, "");
            
            if (longestMatch && longestMatch.length > 40) {
              extractedStrategy = longestMatch;
              logInfo(method, `Estrategia extraída (método 2): "${extractedStrategy.substring(0, 100)}${extractedStrategy.length > 100 ? '...' : ''}"`);
            }
          }
        } catch (regexError) {
          logError(method, 'Error en extracción con regex avanzada', regexError);
        }
      }
      
      // Método 3: Buscar en líneas individuales
      if (!extractedStrategy) {
        try {
          const lines = response.split('\n');
          for (const line of lines) {
            // Buscar líneas que contengan estructura de búsqueda PubMed
            if ((line.includes('[MeSH') || line.includes('[Mesh]') || line.includes('[tiab]')) && 
                (line.includes('AND') || line.includes('OR')) && 
                line.includes('(') && line.includes(')') && 
                line.length > 50) {
              extractedStrategy = line.trim();
              logInfo(method, `Estrategia extraída (método 3): "${extractedStrategy.substring(0, 100)}${extractedStrategy.length > 100 ? '...' : ''}"`);
              break;
            }
          }
        } catch (parseError) {
          logError(method, 'Error en análisis línea por línea', parseError);
        }
      }
      
      if (!extractedStrategy) {
        logInfo(method, 'No se pudo extraer automáticamente la estrategia del texto completo');
      }
      
      return response;
    } catch (error) {
      logError(method, 'Error al generar estrategia de búsqueda', error);
      throw error;
    }
  }
  
  /**
   * Analiza un artículo científico en relación a una pregunta clínica
   * @param {Object} article - Artículo científico a analizar
   * @param {string} clinicalQuestion - Pregunta clínica 
   * @returns {Promise<string>} - Análisis del artículo
   */
  async analyzeArticle(article, clinicalQuestion) {
    const method = 'analyzeArticle';
    
    if (!article) {
      const error = new Error('Se requiere un artículo para analizar');
      logError(method, error.message);
      throw error;
    }
    
    if (!clinicalQuestion) {
      const error = new Error('Se requiere una pregunta clínica');
      logError(method, error.message);
      throw error;
    }
    
    logInfo(method, `Analizando artículo: "${article.title && article.title.substring(0, 100)}${article.title && article.title.length > 100 ? '...' : 'Sin título'}"`);
    logInfo(method, `Para pregunta clínica: "${clinicalQuestion.substring(0, 100)}${clinicalQuestion.length > 100 ? '...' : ''}"`);
    
    const { title, authors, abstract, publicationDate, doi, pmid, meshTerms } = article;
    let authorNames = 'No disponible';
    if (Array.isArray(authors)) {
      authorNames = authors.map(a => a.name || a).join(', ');
    } else if (typeof authors === 'string') {
      authorNames = authors;
    }
    
    const meshTermsText = meshTerms && meshTerms.length > 0
      ? meshTerms.join(", ")
      : "No disponible";

    // Construir el prompt para análisis de artículo como tarjeta visual
    const prompt = `Eres Claude, un asistente experto en análisis crítico de literatura científica biomédica.

Analiza el siguiente artículo científico en relación a la pregunta clínica proporcionada.

Pregunta clínica: ${clinicalQuestion}

Información del artículo:
Título: ${title}
Autores: ${authorNames}
Fecha de publicación: ${publicationDate}
DOI: ${doi || 'No disponible'}
PMID: ${pmid || 'No disponible'}
Términos MeSH: ${meshTermsText}

Abstract: ${abstract}

INSTRUCCIONES:
Tu análisis debe presentarse en formato VISUAL de TARJETA o FICHA TÉCNICA con formato preciso:

<div class="card-analysis">
  <div class="card-header">
    <h3>ANÁLISIS DE EVIDENCIA</h3>
    <div class="badges">
      <span class="badge quality">★★★★☆</span>
      <span class="badge type">Meta-análisis</span>
    </div>
  </div>
  
  <div class="card-section">
    <h4>RESUMEN CLÍNICO</h4>
    <p>Breve resumen del artículo y su relevancia para la pregunta clínica.</p>
  </div>
  
  <div class="card-section">
    <h4>METODOLOGÍA</h4>
    <ul>
      <li><strong>Diseño:</strong> Tipo de estudio</li>
      <li><strong>Muestra:</strong> Número y características</li>
      <li><strong>Duración:</strong> Período de seguimiento</li>
    </ul>
  </div>
  
  <div class="card-section">
    <h4>HALLAZGOS CLAVE</h4>
    <ul>
      <li>Hallazgo principal 1</li>
      <li>Hallazgo principal 2</li>
      <li>Hallazgo principal 3</li>
    </ul>
  </div>
  
  <div class="card-section">
    <h4>EVALUACIÓN CRÍTICA</h4>
    <div class="evaluation-grid">
      <div class="evaluation-item">
        <span class="label">FORTALEZAS</span>
        <ul>
          <li>Fortaleza 1</li>
          <li>Fortaleza 2</li>
        </ul>
      </div>
      <div class="evaluation-item">
        <span class="label">LIMITACIONES</span>
        <ul>
          <li>Limitación 1</li>
          <li>Limitación 2</li>
        </ul>
      </div>
    </div>
  </div>
  
  <div class="card-section">
    <h4>RELEVANCIA CLÍNICA</h4>
    <p>Valoración sobre aplicabilidad de resultados a la práctica.</p>
  </div>
</div>

IMPORTANTE:
1. USA EXACTAMENTE el formato HTML proporcionado - la estructura de divs y clases es esencial.
2. La CALIFICACIÓN de calidad (de 1 a 5 estrellas) debe aparecer como un badge en el encabezado.
   - AJUSTA el número de estrellas según la calidad y relevancia del artículo (1-5 estrellas)
   - Para calificar con 4 estrellas, usa: <span class="badge quality">★★★★☆</span>
   - Para calificar con 3 estrellas, usa: <span class="badge quality">★★★☆☆</span>
   - Para calificar con 5 estrellas, usa: <span class="badge quality">★★★★★</span>
   - Para calificar con 2 estrellas, usa: <span class="badge quality">★★☆☆☆</span>
   - Para calificar con 1 estrella, usa: <span class="badge quality">★☆☆☆☆</span>
3. INCLUYE el TIPO DE ESTUDIO como un segundo badge junto a la calificación.
4. COMPLETA todas las secciones requeridas con información concisa y clara.
5. MANTÉN el análisis breve pero exhaustivo, con énfasis en los puntos más relevantes.`;

    try {
      // Añadir un retraso aleatorio entre 1-3 segundos para evitar superar el rate limit
      const randomDelay = Math.floor(Math.random() * 2000) + 1000;
      logInfo(method, `Añadiendo retraso de ${randomDelay}ms antes de solicitar análisis para evitar rate limiting`);
      await new Promise(resolve => setTimeout(resolve, randomDelay));
      
      logInfo(method, `Longitud del prompt generado: ${prompt.length} caracteres`);
      const response = await this.generateResponse(prompt);
      logInfo(method, 'Análisis de artículo generado exitosamente');
      return response;
    } catch (error) {
      // Si hay un error de rate limit, reintentamos con un retraso mayor
      if (error.message && error.message.includes('rate limit')) {
        logInfo(method, 'Rate limit alcanzado. Reintentando después de un retraso...');
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 segundos de espera
        try {
          logInfo(method, 'Reintentando solicitud de análisis...');
          const response = await this.generateResponse(prompt);
          logInfo(method, 'Análisis de artículo generado exitosamente en segundo intento');
          return response;
        } catch (retryError) {
          logError(method, 'Error en segundo intento de análisis', retryError);
          throw retryError;
        }
      }
      
      logError(method, 'Error al analizar artículo', error);
      throw error;
    }
  }

  /**
   * Genera una síntesis crítica de la evidencia científica basada en múltiples artículos
   * @param {string} clinicalQuestion - Pregunta clínica
   * @param {Array<Object>} articles - Artículos con análisis para sintetizar
   * @returns {Promise<string>} - Síntesis en formato HTML
   */
  async generateSynthesis(clinicalQuestion, articles) {
    const method = 'generateSynthesis';
    
    if (!clinicalQuestion) {
      const error = new Error('Se requiere una pregunta clínica');
      logError(method, error.message);
      throw error;
    }
    
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      const error = new Error('Se requiere un array de artículos');
      logError(method, error.message);
      throw error;
    }
    
    logInfo(method, `Generando síntesis para pregunta: "${clinicalQuestion.substring(0, 100)}${clinicalQuestion.length > 100 ? '...' : ''}" con ${articles.length} artículos`);
    
    // Usar el prompt centralizado desde aiPrompts.js
    const prompt = generateSynthesisPrompt(clinicalQuestion, articles);
    logInfo(method, `Prompt para síntesis generado, longitud: ${prompt.length} caracteres`);
    
    try {
      // Generar la síntesis con un modelo Claude de mayor capacidad
      const synthesisContent = await this.generateResponse(prompt, {
        specificModel: 'claude-3-opus-20240229', // Usar un modelo más capaz para la síntesis
        temperature: 0.5 // Menor temperatura para mayor consistencia
      });
      
      logInfo(method, `Síntesis generada exitosamente. Longitud: ${synthesisContent.length} caracteres`);
      return synthesisContent;
    } catch (error) {
      logError(method, `Error al generar síntesis: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Analiza un lote de artículos en paralelo
   * @param {Array<Object>} articles - Lista de artículos
   * @param {string} clinicalQuestion - Pregunta clínica
   * @returns {Promise<Array<Object>>} - Artículos con análisis
   */
  async analyzeArticleBatch(articles, clinicalQuestion) {
    const method = 'analyzeArticleBatch';
    
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      const error = new Error('Se requiere un array de artículos válido');
      logError(method, error.message);
      throw error;
    }
    
    if (!clinicalQuestion) {
      const error = new Error('Se requiere una pregunta clínica');
      logError(method, error.message);
      throw error;
    }
    
    logInfo(method, `Iniciando análisis de lote con ${articles.length} artículos`);
    logInfo(method, `Pregunta clínica: "${clinicalQuestion.substring(0, 100)}${clinicalQuestion.length > 100 ? '...' : ''}"`);
    
    // Configuración para evitar rate limiting
    const concurrencyLimit = 2; // Máximo 2 artículos simultáneos
    const delayBetweenRequests = 5000; // 5 segundos entre solicitudes
    
    // Función para procesar cada artículo con gestión de errores
    const processArticle = async (article, index) => {
      try {
        // Aplicar retraso para evitar rate limiting (excepto para el primer artículo)
        if (index > 0) {
          const delay = delayBetweenRequests + (Math.random() * 2000); // Añadir aleatoriedad
          logInfo(method, `Esperando ${Math.round(delay/1000)} segundos antes de procesar artículo ${index+1}/${articles.length}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        logInfo(method, `Procesando artículo ${index+1}/${articles.length}: "${article.title?.substring(0, 50) || 'Sin título'}..."`);
        
        // Intentar analizar el artículo
        const analysis = await this.analyzeArticle(article, clinicalQuestion);
        
        logInfo(method, `Artículo ${index+1}/${articles.length} analizado correctamente`);
        return {
          ...article,
          secondaryAnalysis: analysis,
          analyzed: true
        };
      } catch (error) {
        logError(method, `Error al analizar artículo ${index+1}/${articles.length}: ${error.message}`);
        
        // Reintentar una vez si es un error de rate limit o timeout
        if ((error.message && (error.message.includes('rate limit') || error.message.includes('timeout'))) || 
            (error.response && error.response.status === 429)) {
          logInfo(method, `Reintentando artículo ${index+1}/${articles.length} después de pausa extendida`);
          
          // Pausa más larga para el reintento
          await new Promise(resolve => setTimeout(resolve, 15000));
          
          try {
            const analysis = await this.analyzeArticle(article, clinicalQuestion);
            logInfo(method, `Reintento exitoso para artículo ${index+1}/${articles.length}`);
            return {
              ...article,
              secondaryAnalysis: analysis,
              analyzed: true,
              retried: true
            };
          } catch (retryError) {
            logError(method, `Reintento fallido para artículo ${index+1}/${articles.length}: ${retryError.message}`);
            return {
              ...article,
              secondaryAnalysis: `Error: No fue posible analizar este artículo. ${retryError.message}`,
              error: true
            };
          }
        }
        
        return {
          ...article,
          secondaryAnalysis: `Error: No fue posible analizar este artículo. ${error.message}`,
          error: true
        };
      }
    };
    
    // Procesar artículos con límite de concurrencia
    const results = [];
    const startTime = Date.now();
    
    // Dividir los artículos en lotes según el límite de concurrencia
    for (let i = 0; i < articles.length; i += concurrencyLimit) {
      const batch = articles.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map((article, batchIndex) => 
        processArticle(article, i + batchIndex)
      );
      
      // Esperar a que se complete el lote actual antes de procesar el siguiente
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      logInfo(method, `Completado lote ${Math.floor(i/concurrencyLimit) + 1}/${Math.ceil(articles.length/concurrencyLimit)}`);
    }
    
    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;
    const successCount = results.filter(article => article.analyzed && !article.error).length;
    const errorCount = results.filter(article => article.error).length;
    const retriedCount = results.filter(article => article.retried).length;
    
    logInfo(method, `Análisis de lote completado en ${totalTime.toFixed(1)} segundos`);
    logInfo(method, `Resultados: ${successCount} exitosos, ${errorCount} fallidos, ${retriedCount} reintentados`);
    
    return results;
  }
}

// Exportar una instancia del servicio
export default new ClaudeService(); 