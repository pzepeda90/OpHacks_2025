/**
 * Servicio para interactuar con la API de Claude (Anthropic)
 * Usa axios directamente para comunicarse con la API
 */
import axios from 'axios';
import config from '../config/index.js';
import { generateSynthesisPrompt } from '../utils/aiPrompts.js';
import Article from '../models/Article.js';
import { extractMetricsFromText, formatMetrics, getMetricsBadgeStyles } from '../utils/metricsCalculator.js';

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
    console.log(`[${timestamp}] [Claude] [${method}] Datos:`, data);
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
        
        // Aumentar el tiempo de espera a 180 segundos
        const response = await axios.post(url, requestData, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          timeout: 180000 // 180 segundos (3 minutos) de timeout
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
     * Especificidad estimada (% de artículos irrelevantes correctamente descartados)
     * NNR estimado (número necesario a leer para encontrar un artículo relevante)
     * Saturación informativa (% de conceptos potenciales capturados en los resultados)
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
      - Especificidad estimada: [%]
      - NNR estimado: [valor]
      - Saturación estimada: [%]
   
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
   
   Estimación: ~65 resultados, 80% precisión, 75% sensibilidad, 90% especificidad, NNR: 1.25, 85% saturación

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
      
      // Extraer métricas del texto de respuesta
      const extractedMetrics = extractMetricsFromText(response);
      
      // Formatear las métricas y obtener los badges
      const formattedMetrics = formatMetrics(extractedMetrics);
      
      // Formatear la estrategia para mejor visualización
      const formattedStrategy = extractedStrategy ? this.formatSearchStrategy(extractedStrategy) : '';
      
      // Generar el HTML mejorado para la estrategia
      const enhancedResponse = this.formatEnhancedResponse(response, formattedStrategy, formattedMetrics);
      
      // Retornar un objeto con todos los componentes
      return {
        strategy: extractedStrategy || '',  // La estrategia extraída o cadena vacía
        fullResponse: response,             // La respuesta completa de Claude como respaldo
        enhancedResponse: enhancedResponse, // Versión visualmente mejorada para el frontend
        metrics: extractedMetrics           // Métricas extraídas
      };
    } catch (error) {
      logError(method, 'Error al generar estrategia de búsqueda', error);
      throw error;
    }
  }
  
  /**
   * Formatea la estrategia de búsqueda para mejorar su visualización
   * @param {string} strategy - Estrategia de búsqueda cruda
   * @returns {string} Estrategia formateada con HTML
   */
  formatSearchStrategy(strategy) {
    if (!strategy) return '';
    
    // Dividir la estrategia en componentes y operadores
    const components = [];
    let currentComponent = '';
    let depth = 0;
    let openQuotes = false;
    
    // Procesar cada carácter para una división más precisa
    for (let i = 0; i < strategy.length; i++) {
      const char = strategy[i];
      
      if (char === '"') {
        openQuotes = !openQuotes;
        currentComponent += char;
      } else if (char === '(' && !openQuotes) {
        depth++;
        if (depth === 1 && currentComponent.trim()) {
          components.push({type: 'operator', content: currentComponent.trim()});
          currentComponent = '';
        }
        currentComponent += char;
      } else if (char === ')' && !openQuotes) {
        depth--;
        currentComponent += char;
        if (depth === 0) {
          components.push({type: 'block', content: currentComponent.trim()});
          currentComponent = '';
        }
      } else {
        currentComponent += char;
      }
    }
    
    // Agregar cualquier parte restante
    if (currentComponent.trim()) {
      if (currentComponent.trim().match(/AND|OR|NOT/)) {
        components.push({type: 'operator', content: currentComponent.trim()});
      } else {
        components.push({type: 'text', content: currentComponent.trim()});
      }
    }
    
    // Construir el HTML con formato y colores
    let formattedHtml = '<div class="strategy-components">';
    
    components.forEach((component, index) => {
      if (component.type === 'operator') {
        // Operadores lógicos
        formattedHtml += `<div class="strategy-operator">${this.escapeHtml(component.content)}</div>`;
      } else if (component.type === 'block') {
        // Bloques de búsqueda (términos entre paréntesis)
        const content = component.content;
        // Resaltar elementos MeSH y otros términos especiales
        let highlightedContent = content
          .replace(/(".*?"(?:\[.*?\])?)/g, '<span class="strategy-term">$1</span>')
          .replace(/\[(.*?)\]/g, '<span class="strategy-field">[$1]</span>')
          .replace(/(\s+OR\s+)/g, '<span class="strategy-or">$1</span>')
          .replace(/(\s+AND\s+)/g, '<span class="strategy-and">$1</span>')
          .replace(/(\s+NOT\s+)/g, '<span class="strategy-not">$1</span>');
          
        formattedHtml += `<div class="strategy-block">${highlightedContent}</div>`;
      } else {
        // Texto normal
        formattedHtml += `<div class="strategy-text">${this.escapeHtml(component.content)}</div>`;
      }
    });
    
    formattedHtml += '</div>';
    
    // Añadir botón de copia y estilos
    const strategyForCopy = strategy.replace(/[\n\r\s]+/g, ' ');
    
    // Crear un ID único para esta estrategia
    const strategyId = 'strategy-' + Math.random().toString(36).substring(2, 15);
    
    return `<div class="strategy-container">
      <div class="strategy-header">
        <div class="strategy-title">Estrategia optimizada para PubMed</div>
        <button class="copy-btn" onclick="copyStrategy('${strategyId}')">
          <span class="copy-icon">📋</span> Copiar
        </button>
      </div>
      <div class="strategy-code">
        ${formattedHtml}
      </div>
      <div class="strategy-footer">
        <div class="strategy-tip">
          <span class="tip-icon">💡</span>
          <span class="tip-text">Para usar esta estrategia, cópiela y péguela en el cuadro de búsqueda de PubMed</span>
        </div>
      </div>
      <textarea id="${strategyId}" style="position: absolute; top: -9999px; left: -9999px;">${strategyForCopy}</textarea>
    </div>
    
    <script>
    function copyStrategy(id) {
      const textarea = document.getElementById(id);
      textarea.select();
      document.execCommand('copy');
      
      // O usar Clipboard API si está disponible
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textarea.value)
          .then(() => {
            // Feedback visual opcional
            const btn = document.querySelector(\`[onclick="copyStrategy('\${id}')"]\`);
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span class="copy-icon">✓</span> Copiado';
            setTimeout(() => {
              btn.innerHTML = originalText;
            }, 2000);
          })
          .catch(err => {
            console.error('Error al copiar: ', err);
          });
      }
    }
    </script>
    
    <style>
      .strategy-container {
        position: relative;
        margin: 20px 0;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        border: 1px solid #e9ecef;
      }
      
      .strategy-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: #f1f8ff;
        padding: 12px 15px;
        border-bottom: 1px solid #e1e8ed;
      }
      
      .strategy-title {
        font-weight: 600;
        color: #2c3e50;
        font-size: 0.95rem;
      }
      
      .strategy-code {
        background-color: #f8f9fa;
        padding: 15px;
        overflow-x: auto;
        font-family: 'Courier New', Courier, monospace;
        font-size: 14px;
        line-height: 1.6;
      }
      
      .strategy-components {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .strategy-block {
        padding: 10px;
        background-color: #fff;
        border-radius: 6px;
        border-left: 3px solid #3498db;
      }
      
      .strategy-operator {
        align-self: center;
        font-weight: bold;
        color: #34495e;
        background-color: #f0f0f0;
        padding: 3px 10px;
        border-radius: 4px;
        margin: 4px 0;
      }
      
      .strategy-term {
        color: #2980b9;
        font-weight: 600;
      }
      
      .strategy-field {
        color: #16a085;
        font-weight: 500;
      }
      
      .strategy-or {
        color: #e67e22;
        font-weight: bold;
      }
      
      .strategy-and {
        color: #27ae60;
        font-weight: bold;
      }
      
      .strategy-not {
        color: #c0392b;
        font-weight: bold;
      }
      
      .copy-btn {
        background-color: #fff;
        border: 1px solid #dce0e5;
        border-radius: 4px;
        padding: 6px 12px;
        font-size: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
      }
      
      .copy-btn:hover {
        background-color: #f1f8ff;
        border-color: #3498db;
      }
      
      .copy-icon {
        font-size: 14px;
      }
      
      .strategy-footer {
        padding: 10px 15px;
        background-color: #f9f9f9;
        border-top: 1px solid #e9ecef;
      }
      
      .strategy-tip {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.85rem;
        color: #6c757d;
      }
      
      .tip-icon {
        color: #f39c12;
      }
      
      @media (max-width: 768px) {
        .strategy-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
        }
        
        .copy-btn {
          align-self: flex-end;
        }
      }
    </style>`;
  }

  /**
   * Formatea la respuesta mejorada combinando texto original, estrategia formateada y badges
   * @param {string} originalResponse - Respuesta completa de Claude
   * @param {string} formattedStrategy - Estrategia formateada con HTML
   * @param {Object} metrics - Métricas formateadas con badges
   * @returns {string} HTML con toda la información integrada
   */
  formatEnhancedResponse(originalResponse, formattedStrategy, metrics) {
    // Extraer secciones importantes de la respuesta original
    const picoSection = this.extractSection(originalResponse, /ANÁLISIS PICO[^]*?(?=TÉRMINOS PRECISOS|$)/is);
    const termsSection = this.extractSection(originalResponse, /TÉRMINOS PRECISOS[^]*?(?=ESTRATEGIA PRINCIPAL|$)/is);

    // Formatear el análisis PICO en un formato más visual
    const formattedPico = this.formatPicoSection(picoSection);

    // Formatear la sección de términos precisos
    const formattedTerms = this.formatTermsSection(termsSection);

    // Construir el HTML mejorado
    const styles = `<style>
    .enhanced-strategy {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.5;
      color: #333;
      max-width: 900px;
      margin: 0 auto;
      background-color: #fff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0,0,0,0.05);
    }
    
    .strategy-banner {
      background: linear-gradient(135deg, #4b6cb7, #182848);
      color: white;
      padding: 20px;
      text-align: center;
    }
    
    .banner-title {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 8px;
    }
    
    .banner-subtitle {
      font-size: 0.95rem;
      opacity: 0.9;
    }
    
    .strategy-section {
      margin-bottom: 0;
      padding: 25px;
      background-color: white;
      border-bottom: 1px solid #edf2f7;
    }
    
    .strategy-section:last-child {
      border-bottom: none;
    }
    
    .section-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 15px;
      color: #2c3e50;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .section-title::before {
      content: "";
      display: block;
      width: 4px;
      height: 20px;
      background-color: #4b6cb7;
      border-radius: 2px;
    }
    
    .pico-grid {
      display: grid;
      grid-template-columns: auto 1fr auto;
      column-gap: 15px;
      row-gap: 20px;
      align-items: start;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    
    .pico-component {
      display: contents;
    }
    
    .pico-letter {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #4b6cb7;
      color: white;
      font-weight: bold;
      border-radius: 50%;
    }
    
    .pico-content {
      line-height: 1.5;
    }
    
    .pico-title {
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 4px;
    }
    
    .pico-description {
      color: #4a5568;
      font-size: 0.95rem;
    }
    
    .relevance-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
      height: 32px;
      background-color: #ebf5ff;
      color: #3182ce;
      border-radius: 16px;
      font-weight: 600;
      font-size: 0.9rem;
    }
    
    .relevance-5 { background-color: #c6f6d5; color: #38a169; }
    .relevance-4 { background-color: #d6f5fb; color: #319795; }
    .relevance-3 { background-color: #fefcbf; color: #d69e2e; }
    .relevance-2 { background-color: #fed7d7; color: #e53e3e; }
    .relevance-1 { background-color: #e2e8f0; color: #718096; }
    
    .terms-section {
      background-color: #f9fafc;
    }
    
    .terms-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
    }
    
    .terms-group {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.05);
      overflow: hidden;
    }
    
    .terms-header {
      background-color: #edf2f7;
      padding: 10px 15px;
      font-weight: 600;
      color: #2d3748;
    }
    
    .terms-list {
      padding: 15px;
      list-style-position: inside;
      margin: 0;
    }
    
    .terms-list li {
      margin-bottom: 8px;
      font-size: 0.9rem;
      color: #4a5568;
    }
    
    .mesh-term {
      color: #4299e1;
      font-weight: 500;
    }
    
    .tiab-term {
      color: #805ad5;
      font-weight: 500;
    }
    
    .advanced-strategy {
      background-color: #fafafc;
    }
    
    .complete-response {
      background-color: #f8fafc;
    }
    
    details summary {
      cursor: pointer;
      color: #4a5568;
      font-weight: 500;
      margin-bottom: 10px;
      user-select: none;
    }
    
    details summary:hover {
      color: #3182ce;
    }
    
    .full-response {
      background-color: white;
      padding: 15px;
      border-radius: 8px;
      font-size: 0.9rem;
      white-space: pre-wrap;
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid #e2e8f0;
    }
    
    @media (max-width: 768px) {
      .strategy-banner {
        padding: 15px;
      }
      
      .banner-title {
        font-size: 1.2rem;
      }
      
      .strategy-section {
        padding: 15px;
      }
      
      .pico-grid {
        grid-template-columns: auto 1fr;
      }
      
      .relevance-badge {
        grid-column: 2;
        margin-top: 5px;
        justify-self: start;
      }
    }
    
    ${getMetricsBadgeStyles()}
  </style>`;

    // Construir el HTML
    return `${styles}
  <div class="enhanced-strategy">
    <div class="strategy-banner">
      <div class="banner-title">Estrategia de Búsqueda Optimizada</div>
      <div class="banner-subtitle">Generada por IA para maximizar precisión y relevancia</div>
    </div>
    
    <div class="strategy-section">
      <div class="section-title">Análisis PICO de la Pregunta</div>
      <div class="pico-content">
        ${formattedPico || '<p>No se pudo extraer el análisis PICO.</p>'}
      </div>
    </div>
    
    <div class="strategy-section terms-section">
      <div class="section-title">Términos Seleccionados</div>
      <div class="terms-content">
        ${formattedTerms || '<p>No se pudo extraer la lista de términos.</p>'}
      </div>
    </div>
    
    <div class="strategy-section advanced-strategy">
      <div class="section-title">Estrategia de Búsqueda Optimizada</div>
      ${formattedStrategy || '<p>No se pudo extraer la estrategia de búsqueda.</p>'}
      ${metrics.badges}
    </div>
    
    <div class="strategy-section complete-response">
      <div class="section-title">Respuesta Completa</div>
      <details>
        <summary>Mostrar respuesta completa de Claude</summary>
        <div class="full-response">
          ${originalResponse.replace(/\n/g, '<br>')}
        </div>
      </details>
    </div>
  </div>`;
  }
  
  /**
   * Formatea la sección PICO para una mejor visualización
   * @param {string} picoSection - Texto de la sección PICO
   * @returns {string} HTML con formato mejorado
   */
  formatPicoSection(picoSection) {
    if (!picoSection) return '';
    
    // Extraer componentes PICO con sus valores de relevancia
    const components = [
      {
        letter: 'P',
        title: 'Población',
        pattern: /P:?\s*\[([^\]]+)\](?:.*?)-\s*([^-]+)(?:.*?[Rr]elevancia:?\s*(\d)[^\d]?)?/s
      },
      {
        letter: 'I',
        title: 'Intervención',
        pattern: /I:?\s*\[([^\]]+)\](?:.*?)-\s*([^-]+)(?:.*?[Rr]elevancia:?\s*(\d)[^\d]?)?/s
      },
      {
        letter: 'C',
        title: 'Comparador',
        pattern: /C:?\s*\[([^\]]+)\](?:.*?)-\s*([^-]+)(?:.*?[Rr]elevancia:?\s*(\d)[^\d]?)?/s
      },
      {
        letter: 'O',
        title: 'Resultados',
        pattern: /O:?\s*\[([^\]]+)\](?:.*?)-\s*([^-]+)(?:.*?[Rr]elevancia:?\s*(\d)[^\d]?)?/s
      }
    ];
    
    // Extraer componentes PICO específicos para el análisis detallado
    let picoDetails = {};
    
    // Primero intentar con patrones específicos
    components.forEach(component => {
      const match = picoSection.match(component.pattern);
      
      if (match) {
        const title = match[1].trim();
        const description = match[2].trim();
        const relevance = match[3] ? parseInt(match[3], 10) : 3;
        
        // Guardar los detalles para uso posterior
        picoDetails[component.letter] = {
          title: title,
          description: description,
          relevance: relevance
        };
      }
    });
    
    // Construir un patrón alternativo para capturar datos si el patrón principal falló
    if (Object.keys(picoDetails).length === 0) {
      // Intentar otro patrón para encontrar los componentes PICO
      const altPattern = /-\s*([P|I|C|O]):\s*\[([^\]]+)\]\s*-\s*([^-]+)(?:.*?[Rr]elevancia:?\s*(\d))?/g;
      let match;
      
      while ((match = altPattern.exec(picoSection)) !== null) {
        const letter = match[1].toUpperCase();
        const title = match[2].trim();
        const description = match[3].trim();
        const relevance = match[4] ? parseInt(match[4], 10) : 3;
        
        picoDetails[letter] = {
          title: title,
          description: description,
          relevance: relevance
        };
      }
    }
    
    // Intentar extraer directamente si los métodos anteriores fallan
    if (Object.keys(picoDetails).length === 0) {
      // Este es un patrón más genérico que intenta capturar cualquier formato
      const lines = picoSection.split('\n');
      
      for (const line of lines) {
        if (line.trim() === '') continue;
        
        // Buscar líneas con formato "- X: [Title] - Description - Relevancia: N"
        const basicMatch = line.match(/(?:^|\s)([PICO]):\s*\[([^\]]+)\](?:.*?)-\s*([^-]+)(?:.*?[Rr]elevancia:?\s*(\d))?/);
        
        if (basicMatch) {
          const letter = basicMatch[1].toUpperCase();
          const title = basicMatch[2].trim();
          const description = basicMatch[3].trim();
          const relevance = basicMatch[4] ? parseInt(basicMatch[4], 10) : 3;
          
          picoDetails[letter] = {
            title: title,
            description: description,
            relevance: relevance
          };
        }
      }
    }
    
    // Si aún no tenemos detalles, intentar con patrones más generales
    if (Object.keys(picoDetails).length === 0) {
      const basicPicoPattern = /([PICO])\s*:\s*(.+?)(?=\s*[PICO]\s*:|$)/gs;
      let match;
      
      while ((match = basicPicoPattern.exec(picoSection)) !== null) {
        const letter = match[1].toUpperCase();
        const fullDescription = match[2].trim();
        
        // Extraer título y descripción si es posible
        const titleMatch = fullDescription.match(/\[([^\]]+)\]/);
        const title = titleMatch ? titleMatch[1].trim() : fullDescription.substring(0, 30) + "...";
        
        // Eliminar título y otros formatos para extraer la descripción
        let description = fullDescription.replace(/\[[^\]]+\]/, '').trim();
        description = description.replace(/^[-:]*/, '').trim();
        
        picoDetails[letter] = {
          title: title,
          description: description,
          relevance: 3 // Valor predeterminado
        };
      }
    }
    
    // Generar resumen PICO al principio para mayor visibilidad
    let summaryHtml = '<div class="pico-summary" style="margin-bottom: 25px; background-color: #f3f8ff; padding: 18px; border-radius: 8px; border: 1px solid #d0e3ff;">';
    summaryHtml += '<h4 style="color: #4566e0; margin-top: 0; margin-bottom: 12px; font-size: 16px; border-bottom: 2px solid #e6eeff; padding-bottom: 8px;">ANÁLISIS PICO PRIORIZADO:</h4>';
    summaryHtml += '<ul class="pico-summary-list" style="margin: 0; padding-left: 20px;">';
    
    // Si tenemos detalles, agregarlos al resumen
    if (Object.keys(picoDetails).length > 0) {
      for (const [letter, details] of Object.entries(picoDetails)) {
        summaryHtml += `<li style="margin-bottom: 10px;"><strong style="color: #4566e0;">${letter}: [${details.title}]</strong> - ${details.description} <span class="relevance-text" style="font-size: 0.9em; color: #6c47d5;">Relevancia ${details.relevance}</span></li>`;
      }
    } else {
      // Si no pudimos extraer detalles, mostrar mensaje de error
      summaryHtml += '<li>No se pudieron extraer elementos PICO específicos del análisis.</li>';
    }
    
    summaryHtml += '</ul></div>';
    
    // Luego generar la cuadrícula visual detallada
    let picoHtml = '<ul class="pico-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; list-style: none; padding: 0; margin: 25px 0;">';
    
    // Asegurarse de que todos los componentes tengan representación
    components.forEach(component => {
      const details = picoDetails[component.letter];
      
      if (details) {
        picoHtml += `
          <li class="pico-component" style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; display: flex; position: relative; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);">
            <div class="pico-letter" style="width: 40px; height: 40px; border-radius: 50%; background-color: #4566e0; color: white; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 18px; margin-right: 15px;">${component.letter}</div>
            <div class="pico-content" style="flex: 1;">
              <div class="pico-title" style="font-weight: 600; margin-bottom: 5px; color: #333;">${component.title}</div>
              <div class="pico-description" style="font-size: 14px; color: #555;">${details.description}</div>
            </div>
          </li>
        `;
      } else {
        // Si no tenemos datos específicos, usar valores genéricos
        picoHtml += `
          <li class="pico-component" style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; display: flex; position: relative; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);">
            <div class="pico-letter" style="width: 40px; height: 40px; border-radius: 50%; background-color: #4566e0; color: white; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 18px; margin-right: 15px;">${component.letter}</div>
            <div class="pico-content" style="flex: 1;">
              <div class="pico-title" style="font-weight: 600; margin-bottom: 5px; color: #333;">${component.title}</div>
              <div class="pico-description" style="font-size: 14px; color: #555;">No especificado</div>
            </div>
          </li>
        `;
      }
    });
    
    picoHtml += '</ul>';
    
    // Combinar el resumen y la cuadrícula
    return summaryHtml + picoHtml;
  }
  
  /**
   * Formatea la sección de términos para una mejor visualización
   * @param {string} termsSection - Texto de la sección de términos
   * @returns {string} HTML con formato mejorado
   */
  formatTermsSection(termsSection) {
    if (!termsSection) return '';
    
    // Extraer grupos de términos (puede haber varios conceptos)
    const conceptMatches = termsSection.match(/Concepto \d+:([^]*?)(?=Concepto \d+:|$)/g);
    
    if (!conceptMatches) return termsSection;
    
    let termsHtml = '<div class="terms-container">';
    
    conceptMatches.forEach((conceptBlock, index) => {
      // Extraer nombre del concepto
      const conceptMatch = conceptBlock.match(/Concepto \d+:(.+?)(?=\[|\n|$)/);
      const conceptName = conceptMatch ? conceptMatch[1].trim() : `Concepto ${index + 1}`;
      
      // Buscar términos MeSH y términos de texto libre
      const meshTerms = [];
      const tiabTerms = [];
      
      // Buscar términos MeSH
      const meshMatches = conceptBlock.match(/["'][^"']+["']\[Mesh[^\]]*\]/g);
      if (meshMatches) {
        meshMatches.forEach(term => {
          meshTerms.push(term.trim());
        });
      }
      
      // Buscar términos tiab (texto en título/resumen)
      const tiabMatches = conceptBlock.match(/["'][^"']+["']\[tiab\]/g);
      if (tiabMatches) {
        tiabMatches.forEach(term => {
          tiabTerms.push(term.trim());
        });
      }
      
      // Si no se encontraron términos específicos, dividir por líneas o comas
      if (meshTerms.length === 0 && tiabTerms.length === 0) {
        const terms = conceptBlock
          .replace(/Concepto \d+:.+?\n/g, '')
          .split(/[,\n]/)
          .map(t => t.trim())
          .filter(t => t && t.length > 1);
        
        terms.forEach(term => {
          if (term.includes('[Mesh') || term.includes('MeSH')) {
            meshTerms.push(term);
          } else if (term.includes('[tiab') || term.toLowerCase().includes('texto libre')) {
            tiabTerms.push(term);
          } else {
            // Si no podemos determinar el tipo, asumimos que es un término general
            tiabTerms.push(term);
          }
        });
      }
      
      // Generar HTML para este grupo de términos
      termsHtml += `
        <div class="terms-group">
          <div class="terms-header">${conceptName}</div>
          <ul class="terms-list">
      `;
      
      // Añadir términos MeSH
      if (meshTerms.length > 0) {
        meshTerms.forEach(term => {
          termsHtml += `<li><span class="mesh-term">${term}</span></li>`;
        });
      }
      
      // Añadir términos tiab
      if (tiabTerms.length > 0) {
        tiabTerms.forEach(term => {
          termsHtml += `<li><span class="tiab-term">${term}</span></li>`;
        });
      }
      
      termsHtml += `
          </ul>
        </div>
      `;
    });
    
    termsHtml += '</div>';
    return termsHtml;
  }

  /**
   * Extrae una sección específica del texto de respuesta usando regex
   * @param {string} text - Texto completo
   * @param {RegExp} pattern - Patrón para extraer la sección
   * @returns {string} Sección extraída o cadena vacía
   */
  extractSection(text, pattern) {
    const match = text.match(pattern);
    return match ? match[0] : '';
  }

  /**
   * Escapa caracteres especiales para su uso en HTML
   * @param {string} text - Texto a escapar
   * @returns {string} Texto escapado
   */
  escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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
    <h4>ANÁLISIS PICO</h4>
    <p>Identifica claramente los componentes PICO del estudio. Utiliza el siguiente formato exacto:</p>
    <ul>
      <li>P: [Nombre población] - Descripción detallada - Relevancia: # (1-5)</li>
      <li>I: [Nombre intervención] - Descripción detallada - Relevancia: # (1-5)</li>
      <li>C: [Nombre comparador] - Descripción detallada - Relevancia: # (1-5)</li>
      <li>O: [Nombre resultado] - Descripción detallada - Relevancia: # (1-5)</li>
    </ul>
  </div>
  
  <div class="card-section">
    <h4>TÉRMINOS PRECISOS</h4>
    <p>Lista los términos MeSH y de texto libre más apropiados para buscar estudios similares.</p>
    <p>Concepto 1: Nombre del concepto principal</p>
    <ul>
      <li>"Término 1"[Mesh]</li>
      <li>"Término 2"[tiab]</li>
    </ul>
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
5. MANTÉN el análisis breve pero exhaustivo, con énfasis en los puntos más relevantes.
6. La sección ANÁLISIS PICO debe estar muy bien detallada, es clave para el análisis.
7. En TÉRMINOS PRECISOS incluye términos específicos MeSH y términos de texto libre.`;

    try {
      // Utilizar exponential backoff para manejar timeout
      const processResponse = async (prompt, maxRetries = 3) => {
        let attempt = 0;
        let lastError;
        
        while (attempt < maxRetries) {
          attempt++;
          try {
            logInfo(method, `Intento ${attempt}/${maxRetries} de análisis`);
            
            // Tiempo de backoff exponencial: 10s, 20s, 40s...
            const backoffTime = Math.pow(2, attempt - 1) * 10;
            
            const response = await this.generateResponse(prompt, {
              maxTokens: 2500,
              temperature: 0.2,
              timeout: backoffTime * 1000, // Convertir segundos a ms
            });
            
            logInfo(method, `Análisis generado exitosamente en intento ${attempt}`);
            return response;
          } catch (error) {
            lastError = error;
            logError(method, `Error en intento ${attempt}: ${error.message}`);
            
            // Si hemos agotado los reintentos, lanzar el error
            if (attempt >= maxRetries) {
              throw error;
            }
            
            // Asegurarnos de que backoffTime esté definido incluso en caso de error
            const retryBackoffTime = Math.pow(2, attempt) * 10;
            
            // Si tenemos más reintentos, esperar antes del siguiente intento
            logInfo(method, `Esperando ${retryBackoffTime}s antes del siguiente intento...`);
            await new Promise(resolve => setTimeout(resolve, retryBackoffTime * 1000));
          }
        }
        
        throw lastError; // No debería llegar aquí, pero por si acaso
      };
      
      // Obtener respuesta de Claude con reintentos
      const response = await processResponse(detailedPrompt);
      
      // Procesar la respuesta para extraer y formatear elementos PICO y términos
      const picoSection = this.extractSection(response, /<div class="card-section">\s*<h4>ANÁLISIS PICO<\/h4>.*?<\/div>/s);
      const termsSection = this.extractSection(response, /<div class="card-section">\s*<h4>TÉRMINOS PRECISOS<\/h4>.*?<\/div>/s);
      
      // Formatear secciones extraídas
      const formattedPico = this.formatPicoSection(picoSection);
      const formattedTerms = this.formatTermsSection(termsSection);
      
      // Si tenemos análisis PICO formateado, colocarlo al principio de la tarjeta
      let processedResponse = response;
      if (formattedPico) {
        // Reemplazar la sección original PICO con cadena vacía
        processedResponse = processedResponse.replace(/<div class="card-section">\s*<h4>ANÁLISIS PICO<\/h4>.*?<\/div>/s, '');
        
        // Insertar el PICO formateado después del encabezado de la tarjeta
        processedResponse = processedResponse.replace(
          /(<div class="card-analysis">.*?<\/div>\s*<\/div>)/s, 
          `$1\n\n${formattedPico}`
        );
      }
      
      // Si tenemos términos formateados, colocarlos después del PICO
      if (formattedTerms) {
        // Reemplazar la sección original de términos con cadena vacía
        processedResponse = processedResponse.replace(/<div class="card-section">\s*<h4>TÉRMINOS PRECISOS<\/h4>.*?<\/div>/s, '');
        
        // Buscar dónde insertar los términos (después del PICO si existe o después del encabezado)
        if (formattedPico) {
          const picoEnd = processedResponse.indexOf(formattedPico) + formattedPico.length;
          processedResponse = processedResponse.slice(0, picoEnd) + 
                            `\n\n<div class="terms-section" style="margin: 20px 0;">\n${formattedTerms}\n</div>` +
                            processedResponse.slice(picoEnd);
        } else {
          processedResponse = processedResponse.replace(
            /(<div class="card-analysis">.*?<\/div>\s*<\/div>)/s, 
            `$1\n\n<div class="terms-section" style="margin: 20px 0;">\n${formattedTerms}\n</div>`
          );
        }
      }
      
      // Asegurarse de que no haya secciones PICO o términos vacías o con "no especificado"
      processedResponse = processedResponse.replace(/<ul class="pico-grid">\s*<li[^>]*>[^<]*no especificado[^<]*<\/li>\s*<\/ul>/gi, '');
      
      return processedResponse;
      
    } catch (error) {
      logError(method, `Error al analizar artículo: ${error.message}`);
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
        specificModel: 'claude-3-haiku-20240307', // Usar un modelo más capaz para la síntesis
        temperature: 0.3 // Menor temperatura para mayor consistencia
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
    
    // ---- IMPLEMENTACIÓN PARA MANEJAR RATE LIMITING ----
    // Incrementar significativamente el tiempo entre solicitudes
    const delayBetweenRequests = 20000; // 20 segundos entre solicitudes
    
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
        
        // Emitir progreso actual a través de socket
        emitBatchProgress(true, validArticles.length, i + 1);
        
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
        
        // Actualizar progreso incluso en caso de error
        emitBatchProgress(true, validArticles.length, i + 1);
      }
    }
    
    // Finalizar la emisión de progreso
    emitBatchProgress(false, validArticles.length, validArticles.length);
    
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
