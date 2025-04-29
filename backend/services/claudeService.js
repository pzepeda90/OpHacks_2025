/**
 * Servicio para interactuar con la API de Claude (Anthropic)
 * Usa axios directamente para comunicarse con la API
 */
import axios from 'axios';
import config from '../config/index.js';
import { generateSynthesisPrompt } from '../utils/aiPrompts.js';
import Article from '../models/Article.js';

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
    
    // Implementar una función de reintento con backoff exponencial
    const maxRetries = options.maxRetries || 3;
    let attempt = 0;
    let delay = 2000; // Retraso inicial de 2 segundos
    let lastError = null;
    
    while (attempt < maxRetries) {
      try {
        // Si no es el primer intento, esperar antes de reintentar
        if (attempt > 0) {
          logInfo(method, `Reintento ${attempt+1}/${maxRetries} después de ${delay/1000} segundos debido a error: ${lastError.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          // Duplicar el tiempo de espera para el próximo intento (backoff exponencial)
          delay = Math.min(delay * 2, 120000); // Máximo 2 minutos de espera
        }
        
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
        lastError = error;
        
        // Mensajes de error más específicos según el tipo de error
        let errorMessage = `Error después de ${durationMs}ms: `;
        
        if (error.code === 'ECONNABORTED') {
          errorMessage += 'Tiempo de espera agotado. La API tardó demasiado en responder.';
        } else if (error.response && error.response.status === 429) {
          errorMessage += 'Demasiadas solicitudes. Se ha superado el límite de rate limit de la API.';
          // Para errores de rate limit especialmente, obtener info de headers si está disponible
          if (error.response && error.response.headers) {
            const retryAfter = error.response.headers['retry-after'];
            const resetTime = error.response.headers['anthropic-ratelimit-tokens-reset'];
            
            if (retryAfter) {
              logInfo(method, `API sugiere reintentar después de ${retryAfter} segundos`);
              // Usar el valor sugerido por la API para el próximo retraso, convertido a ms
              delay = (parseInt(retryAfter) + 5) * 1000; // Añadir 5 segundos extra por seguridad
            }
            
            if (resetTime) {
              logInfo(method, `Rate limit se restablecerá en: ${resetTime}`);
            }
          }
          
          // Para rate limit, asegurarse de que esperamos bastante tiempo en el próximo intento
          if (attempt === maxRetries - 1) {
            throw new Error(errorMessage); // Último intento, propagar el error
          }
          
          // En intentos intermedios, continuar con el ciclo para reintentar
          attempt++;
          continue;
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
        
        // Si no es un error de rate limit o es el último intento, propagar el error
        if (!(error.response && error.response.status === 429) || attempt === maxRetries - 1) {
          throw new Error(errorMessage);
        }
        
        // Incrementar el número de intentos para continuar el ciclo
        attempt++;
      }
    }
    
    // Este punto no debería alcanzarse normalmente
    throw lastError || new Error('Falló después de múltiples intentos');
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
    const prompt = `Eres Claude, un asistente experto en investigación biomédica, bibliometría y estrategias de búsqueda con alta precisión.

Por favor, desarrolla una estrategia de búsqueda OPTIMIZADA para PubMed que genere aproximadamente 50-70 resultados altamente relevantes para la siguiente pregunta clínica, minimizando el NNR (Número Necesario a Leer).

INSTRUCCIONES PRECISAS:

1. ANÁLISIS PICO CUANTIFICADO:
   - Identifica los componentes PICO de la pregunta
   - Asigna un "peso de relevancia" a cada componente (escala 1-5)
   - Identifica exactamente qué componentes DEBEN estar presentes para que un artículo sea relevante

2. DESARROLLO DE TÉRMINOS PRIORITARIOS:
   - Para cada concepto clave, identifica:
     a) Los 2-3 términos MeSH MÁS ESPECÍFICOS y relevantes (evita términos más amplios)
     b) Los 3-5 términos de texto libre [tiab] MÁS PRECISOS
     c) Solo las abreviaturas ESTÁNDAR y ampliamente utilizadas
   - Prioriza precisión sobre exhaustividad

3. ESTRUCTURA DE BÚSQUEDA CALIBRADA:
   - Utiliza el enfoque "building blocks" con filtros progresivos:
     * Bloque 1: Conceptos principales conectados con AND
     * Bloque 2: Aplica limitadores contextuales precisos 
     * Bloque 3: Si es necesario, aplica filtros metodológicos o temporales
   - Calibra la búsqueda para obtener 50-70 resultados

4. ESTIMACIÓN CUANTITATIVA:
   - Para cada versión de la estrategia, proporciona:
     * Número estimado de resultados (busca entre 50-70)
     * Precisión esperada (% de artículos que serán relevantes)
     * Sensibilidad estimada (% de todos los artículos relevantes que capturará)
   - Si una estrategia produce >100 resultados, restringe más
   - Si produce <30 resultados, haz una versión alternativa menos restrictiva

5. ESTRUCTURA DE LA RESPUESTA:
   
   a) ANÁLISIS PICO PRIORIZADO:
      - P: [Población] - Relevancia: [1-5]
      - I: [Intervención] - Relevancia: [1-5]
      - C: [Comparador] - Relevancia: [1-5]
      - O: [Outcomes] - Relevancia: [1-5]
   
   b) TÉRMINOS PRECISOS (SOLO LOS MÁS ESPECÍFICOS):
      - Concepto 1: [Lista de SOLO los términos más precisos]
      - Concepto 2: [Lista de SOLO los términos más precisos]
      - [etc.]
   
   c) ESTRATEGIA PRINCIPAL (OBJETIVO: 50-70 RESULTADOS):
      - Estrategia completa formateada para PubMed
      - Número estimado de resultados: [40-80]
      - Precisión estimada: [%]
      - Sensibilidad estimada: [%]
   
   d) ESTRATEGIA ALTERNATIVA:
      - Una versión ligeramente diferente si la principal está fuera del rango objetivo
      - Número estimado de resultados: [40-80]
   
   e) VALIDACIÓN PROPUESTA:
      - Método para validar la sensibilidad/especificidad de la búsqueda
      - Artículos clave que DEBEN aparecer en los resultados

6. EJEMPLOS DE ESTRATEGIAS CALIBRADAS:
   
   Ejemplo para pregunta sobre metotrexato en desprendimiento de retina con PVR:
   
   ESTRATEGIA CALIBRADA (50-70 RESULTADOS):
   ("Methotrexate"[Mesh:NoExp] OR methotrexate[ti] OR MTX[ti]) 
   AND 
   ("Retinal Detachment"[Majr:NoExp] OR "retinal detachment"[ti]) 
   AND 
   ("Proliferative Vitreoretinopathy"[Mesh] OR "PVR"[ti] OR "proliferative vitreoretinopathy"[ti])
   
   Estimación: ~65 resultados, 80% precisión, 75% sensibilidad

7. TÉCNICAS ESPECÍFICAS PARA CALIBRACIÓN DE RESULTADOS:
   - Uso de [Majr] para términos MeSH como tema principal
   - Restricción a títulos [ti] para máxima relevancia
   - Uso de [Mesh:NoExp] para evitar inclusión de términos más específicos
   - Combinación precisa de filtros metodológicos cuando sea apropiado
   - Restricción por campos de alta precisión (título, autor keywords)

Pregunta clínica: ${clinicalQuestion}`;

    try {
      logInfo(method, 'Enviando prompt estructurado a Claude para generar estrategia de búsqueda');
      const startTime = Date.now();
      const response = await this.generateResponse(prompt);
      const endTime = Date.now();
      logInfo(method, `Estrategia de búsqueda generada exitosamente en ${endTime - startTime}ms`);
      
      // Intenta extraer la estrategia de búsqueda final para facilitar su uso
      let extractedStrategy = null;
      
      // Método 1: Buscar sección "ESTRATEGIA PRINCIPAL" o "ESTRATEGIA DE BÚSQUEDA"
      const estrategiaPatterns = [
        /ESTRATEGIA PRINCIPAL[^]*?\)([^]*?)(?=ESTRATEGIA ALTERNATIVA|VALIDACIÓN|$)/is,
        /c\) ESTRATEGIA PRINCIPAL[^]*?\)([^]*?)(?=d\)|$)/is,
        /ESTRATEGIA CALIBRADA[^]*?(\([^)]*\)(?:\s+(?:AND|OR)\s+\([^)]*\))*)/is,
        /ESTRATEGIA DE BÚSQUEDA COMPLETA:[\s\S]*?(\(.+?\)(?:\s+(?:AND|OR|NOT)\s+\(.+?\))*)/i
      ];
      
      for (const pattern of estrategiaPatterns) {
        const match = response.match(pattern);
        if (match && match[1] && match[1].length > 30) {
          extractedStrategy = match[1].trim();
          logInfo(method, `Estrategia extraída (patrones): "${extractedStrategy.substring(0, 100)}${extractedStrategy.length > 100 ? '...' : ''}"`);
          break;
        }
      }
      
      // Método 2: Buscar secuencia de términos MeSH y operadores booleanos si el método 1 falló
      if (!extractedStrategy) {
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
      
      // Método 3: Buscar en líneas individuales si los métodos anteriores fallaron
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
      
      // Retornar un objeto con la estrategia extraída y el texto completo
      return {
        strategy: extractedStrategy || '',  // La estrategia extraída o cadena vacía si no se encontró
        fullResponse: response             // La respuesta completa de Claude como respaldo
      };
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
    const detailedPrompt = `Eres Claude, un asistente experto en análisis crítico de literatura científica biomédica.

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

    // Construir un prompt simplificado para usar en caso de fallo
    const simplifiedPrompt = `Analiza brevemente el siguiente artículo en relación a esta pregunta clínica:
Pregunta: ${clinicalQuestion}
Título: ${title}
Abstract: ${abstract}

Genera un análisis conciso con este formato HTML exacto:

<div class="card-analysis">
  <div class="card-header">
    <h3>ANÁLISIS DE EVIDENCIA</h3>
    <div class="badges">
      <span class="badge quality">★★☆☆☆</span>
      <span class="badge type">Resumen</span>
    </div>
  </div>
  <div class="card-section">
    <h4>RESUMEN CLÍNICO</h4>
    <p>[Breve resumen y relevancia]</p>
  </div>
  <div class="card-section">
    <h4>RELEVANCIA CLÍNICA</h4>
    <p>[Aplicabilidad de resultados]</p>
  </div>
</div>`;

    // Función para reintento con backoff exponencial
    const retryWithExponentialBackoff = async (prompt, maxRetries = 3) => {
      let lastError;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // Añadir retraso exponencial entre intentos (excepto el primero)
          if (attempt > 0) {
            const delay = Math.pow(2, attempt) * 3000 + (Math.random() * 1000);
            logInfo(method, `Reintento ${attempt+1}/${maxRetries} después de ${Math.round(delay/1000)} segundos`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else if (attempt === 0) {
            // Pequeño retraso aleatorio inicial
            const randomDelay = Math.floor(Math.random() * 2000) + 1000;
            logInfo(method, `Añadiendo retraso de ${randomDelay}ms antes de solicitar análisis`);
            await new Promise(resolve => setTimeout(resolve, randomDelay));
          }
          
          logInfo(method, `Intento ${attempt+1}/${maxRetries}: Longitud del prompt: ${prompt.length} caracteres`);
          const response = await this.generateResponse(prompt, {
            temperature: 0.5 + (attempt * 0.1) // Aumentar ligeramente la temperatura en cada reintento
          });
          logInfo(method, `Análisis generado exitosamente en intento ${attempt+1}`);
          return response;
        } catch (error) {
          lastError = error;
          logError(method, `Error en intento ${attempt+1}: ${error.message}`);
          
          // Si no es un error de rate limit o si estamos en el último intento, no continuar
          if ((!error.message || 
              (!error.message.includes('rate limit') && 
               !error.message.includes('timeout') && 
               !error.message.includes('429'))) && 
              attempt === maxRetries - 1) {
            throw error;
          }
        }
      }
      
      // Si llegamos aquí, todos los reintentos fallaron
      throw lastError || new Error('Todos los intentos fallaron');
    };

    try {
      // Primer intento con el prompt detallado
      return await retryWithExponentialBackoff(detailedPrompt, 3);
    } catch (mainError) {
      logError(method, `Fallo en análisis con prompt detallado: ${mainError.message}. Intentando con prompt simplificado.`);
      
      try {
        // Si falla, intentar con el prompt simplificado
        return await retryWithExponentialBackoff(simplifiedPrompt, 2);
      } catch (fallbackError) {
        logError(method, `Error en análisis con prompt simplificado: ${fallbackError.message}`);
        
        // Si todo falla, devolver un mensaje de error en formato HTML compatible
        return `<div class="card-analysis">
  <div class="card-header">
    <h3>ANÁLISIS DE EVIDENCIA</h3>
    <div class="badges">
      <span class="badge quality">★☆☆☆☆</span>
      <span class="badge type">Error</span>
    </div>
  </div>
  <div class="card-section">
    <h4>ERROR DE ANÁLISIS</h4>
    <p>No fue posible analizar este artículo. Error: ${fallbackError.message || 'Desconocido'}</p>
  </div>
</div>`;
      }
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
    
    // Filtrar artículos que no sean válidos para análisis
    const validArticles = articles.filter(article => {
      try {
        const articleObj = new Article(article);
        return articleObj.validateForAnalysis();
      } catch (error) {
        logError(method, `Error al validar artículo: ${error.message}`);
        return false;
      }
    });
    
    logInfo(method, `De ${articles.length} artículos, ${validArticles.length} son válidos para análisis`);
    
    // Si no hay artículos válidos, devolver el array original con mensajes de error
    if (validArticles.length === 0) {
      logInfo(method, 'No hay artículos válidos para analizar, devolviendo array original con mensajes de error');
      return articles.map(article => ({
        ...article,
        secondaryAnalysis: `Error: El artículo no contiene suficiente información para ser analizado. Se requiere un título válido, abstract extenso e identificador.`,
        error: true,
        analyzed: false
      }));
    }
    
    // ---- NUEVA IMPLEMENTACIÓN PARA MANEJAR RATE LIMITING ----
    // Incrementar significativamente el tiempo entre solicitudes
    const delayBetweenRequests = 20000; // 20 segundos entre solicitudes (incrementado desde 10s)
    
    // Función para procesar cada artículo con gestión mejorada de errores y rate limits
    const processArticle = async (article, index) => {
      logInfo(method, `Procesando artículo ${index+1}/${validArticles.length}: "${article.title?.substring(0, 50) || 'Sin título'}..."`);
      
      // Siempre aplicar retraso para evitar rate limiting (excepto el primer artículo)
      if (index > 0) {
        // Incrementar la aleatoriedad para distribuir mejor las solicitudes
        const delay = delayBetweenRequests + (Math.random() * 10000); // Añadir hasta 10 segundos adicionales aleatorios
        logInfo(method, `Esperando ${Math.round(delay/1000)} segundos antes de procesar artículo ${index+1}/${validArticles.length}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      try {
        // Intentar analizar el artículo
        const analysis = await this.analyzeArticle(article, clinicalQuestion);
        
        logInfo(method, `Artículo ${index+1}/${validArticles.length} analizado correctamente`);
        return {
          ...article,
          secondaryAnalysis: analysis,
          analyzed: true
        };
      } catch (error) {
        // Verificar si es un error de rate limit específicamente
        if (error.message && (error.message.includes('rate limit') || error.message.includes('429'))) {
          logError(method, `Error de rate limit en artículo ${index+1}/${validArticles.length}. Esperando antes de reintentar.`);
          
          // Esperar un tiempo significativo antes de reintentar (1-2 minutos)
          const retryDelay = 60000 + (Math.random() * 60000);
          logInfo(method, `Esperando ${Math.round(retryDelay/1000)} segundos antes de reintentar debido a rate limit...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          
          try {
            // Reintentar una vez después de esperar
            logInfo(method, `Reintentando análisis para artículo ${index+1}/${validArticles.length}...`);
            const analysis = await this.analyzeArticle(article, clinicalQuestion);
            
            logInfo(method, `Reintento exitoso para artículo ${index+1}/${validArticles.length}`);
            return {
              ...article,
              secondaryAnalysis: analysis,
              analyzed: true
            };
          } catch (retryError) {
            logError(method, `Reintento fallido para artículo ${index+1}/${validArticles.length}: ${retryError.message}`);
            return {
              ...article,
              secondaryAnalysis: `Error: No fue posible analizar este artículo después de múltiples intentos. El servicio puede estar experimentando alta demanda. Error: ${retryError.message}`,
              error: true,
              analyzed: false
            };
          }
        } else {
          // Otro tipo de error
          logError(method, `Error al analizar artículo ${index+1}/${validArticles.length}: ${error.message}`);
          return {
            ...article,
            secondaryAnalysis: `Error: No fue posible analizar este artículo. ${error.message}`,
            error: true,
            analyzed: false
          };
        }
      }
    };
    
    // Procesar artículos de forma secuencial para evitar sobrecargar la API
    const results = [];
    const startTime = Date.now();
    
    // Procesamiento secuencial para evitar rate limits
    for (let i = 0; i < validArticles.length; i++) {
      // Procesar un solo artículo a la vez
      try {
        const result = await processArticle(validArticles[i], i);
        results.push(result);
        
        // Registrar progreso
        logInfo(method, `Completado artículo ${i+1}/${validArticles.length}`);
        
        // Si quedan más artículos, mostrar porcentaje completado
        if (i < validArticles.length - 1) {
          const percentComplete = Math.round(((i + 1) / validArticles.length) * 100);
          logInfo(method, `Progreso: ${percentComplete}% completado (${i+1}/${validArticles.length})`);
          
          // Verificar si estamos cerca del límite de artículos, añadir pausa adicional para asegurar reseteo de rate limits
          if (validArticles.length > 3 && i > 0 && i % 3 === 0) {
            logInfo(method, `Pausa preventiva de rate limit después de ${i+1} artículos`);
            await new Promise(resolve => setTimeout(resolve, 60000)); // Pausa de 1 minuto cada 3 artículos
          }
        }
      } catch (error) {
        // Manejar errores inesperados en el nivel más alto
        logError(method, `Error inesperado al procesar lote para artículo ${i+1}: ${error.message}`);
        results.push({
          ...validArticles[i],
          secondaryAnalysis: `Error: Ocurrió un error inesperado al analizar este artículo. ${error.message}`,
          error: true,
          analyzed: false
        });
      }
    }
    
    // Añadir artículos inválidos con mensaje de error
    const invalidArticles = articles.filter(a1 => !validArticles.some(a2 => a2.pmid === a1.pmid));
    const invalidResults = invalidArticles.map(article => ({
      ...article,
      secondaryAnalysis: `Error: El artículo no contiene suficiente información para ser analizado.`,
      error: true,
      analyzed: false,
      invalid: true
    }));
    
    // Combinar resultados de artículos válidos e inválidos
    const finalResults = [...results, ...invalidResults];
    
    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;
    const successCount = finalResults.filter(article => article.analyzed && !article.error).length;
    const errorCount = finalResults.filter(article => article.error).length;
    const invalidCount = finalResults.filter(article => article.invalid).length;
    
    logInfo(method, `Análisis de lote completado en ${totalTime.toFixed(1)} segundos`);
    logInfo(method, `Resultados: ${successCount} exitosos, ${errorCount} fallidos, ${invalidCount} inválidos`);
    
    return finalResults;
  }

  /**
   * Filtra artículos basados en la relevancia de sus títulos respecto a una pregunta clínica
   * @param {Array} articles - Array de artículos con al menos título y PMID
   * @param {String} question - Pregunta clínica
   * @param {Object} options - Opciones adicionales
   * @param {Number} options.limit - Número máximo de artículos a devolver (default: 20)
   * @returns {Promise<Array>} - Array de artículos filtrados
   */
  async filterByTitles(articles, question, options = {}) {
    const method = 'filterByTitles';
    const limit = options.limit || 20;
    
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      logInfo(method, 'No hay artículos para filtrar');
      return [];
    }

    if (!question) {
      const error = new Error('Se requiere una pregunta clínica para filtrar artículos');
      logError(method, error.message);
      throw error;
    }

    logInfo(method, `Filtrando ${articles.length} artículos por relevancia de título (límite: ${limit})`);
    
    // Crear lista de artículos con PMID y título
    const articlesList = articles.map(article => {
      return {
        pmid: article.pmid,
        title: article.title || 'Sin título'
      };
    });

    // Construir el prompt para Claude
    const prompt = `
Eres un asistente médico especializado que ayuda a médicos a encontrar información relevante para preguntas clínicas.

PREGUNTA CLÍNICA:
${question}

TAREA:
Analiza la siguiente lista de títulos de artículos científicos e identifica los más relevantes para responder la pregunta clínica.
Selecciona hasta ${limit} artículos que parezcan más relevantes basándote ÚNICAMENTE en sus títulos.

CRITERIOS DE SELECCIÓN:
- Relevancia directa para la pregunta clínica
- Especificidad para la condición o intervención mencionada
- Preferencia por ensayos clínicos, meta-análisis o revisiones sistemáticas
- Actualidad (si es aparente en el título)

LISTA DE ARTÍCULOS:
${articlesList.map(a => `PMID: ${a.pmid} - ${a.title}`).join('\n')}

FORMATO DE RESPUESTA:
Responde ÚNICAMENTE con una lista de PMIDs de los artículos seleccionados, uno por línea, sin explicaciones adicionales.
Ejemplo:
12345678
87654321
`;

    try {
      // Llamar a Claude para filtrar artículos
      const response = await this.generateResponse(prompt);
      logInfo(method, `Respuesta de Claude recibida, extrayendo PMIDs`);

      // Extraer PMIDs de la respuesta
      const selectedPMIDs = response
        .split('\n')
        .map(line => line.trim())
        .filter(line => /^\d+$/.test(line))
        .map(pmid => pmid.trim());

      if (selectedPMIDs.length === 0) {
        logInfo(method, 'No se pudieron extraer PMIDs de la respuesta de Claude, usando fallback');
        logInfo(method, `Respuesta de Claude: ${response.substring(0, 200)}...`);
        return articles.slice(0, limit); // Devolver los primeros artículos como fallback
      }

      logInfo(method, `PMIDs seleccionados por Claude: ${selectedPMIDs.join(', ')}`);

      // Filtrar artículos originales por los PMIDs seleccionados
      const filteredArticles = articles.filter(article => 
        selectedPMIDs.includes(article.pmid));

      logInfo(method, `Filtrado completado: ${filteredArticles.length} artículos seleccionados`);
      
      // Si no hay coincidencias, devolver los primeros artículos como fallback
      if (filteredArticles.length === 0) {
        logInfo(method, 'Ningún PMID seleccionado coincide con los artículos originales, usando fallback');
        return articles.slice(0, limit);
      }

      return filteredArticles;
    } catch (error) {
      logError(method, `Error al filtrar títulos: ${error.message}`, error);
      throw new Error(`Error al filtrar títulos: ${error.message}`);
    }
  }

  /**
   * Filtra artículos basados en la relevancia de sus títulos respecto a una pregunta clínica
   * @param {Array} articles - Array de artículos con al menos título y PMID
   * @param {String} question - Pregunta clínica
   * @param {Object} options - Opciones adicionales
   * @param {Number} options.limit - Número máximo de artículos a devolver (default: 20)
   * @returns {Promise<Array>} - Array de artículos filtrados
   */
  async filterTitlesByRelevance(articles, question, options = {}) {
    return this.filterByTitles(articles, question, options);
  }
}

// Exportar una instancia del servicio
export default new ClaudeService(); 