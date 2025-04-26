/**
 * Controlador para las consultas científicas
 * Coordina los servicios de PubMed y Claude para procesar consultas
 */
import pubmedService from '../services/pubmedService.js';
import claudeService from '../services/claudeService.js';
import iCiteService from '../services/iciteService.js';
import { errorTypes } from '../middlewares/errorHandler.js';
import queryLogger from '../utils/scientificQueryLogger.js';

const scientificQueryController = {
  /**
   * Valida y optimiza una estrategia de búsqueda para PubMed
   * @param {string} strategy - Estrategia de búsqueda a validar
   * @returns {string} - Estrategia validada y optimizada
   */
  _validateSearchStrategy(strategy) {
    if (!strategy) return '';
    
    console.log('Validando estrategia de búsqueda...');
    
    // Extraer solo una consulta PubMed válida desde cualquier texto
    const extractPubMedQuery = (text) => {
      console.log('Extrayendo consulta PubMed desde el texto');
      
      // Buscar directamente una expresión entre paréntesis con operadores booleanos
      const directQueryRegex = /\(\s*(?:"[^"]+"(?:\[[^\]]+\])?(?:\s+(?:OR|AND|NOT)\s+"[^"]+"(?:\[[^\]]+\])?)*)\s*\)(?:\s+(?:AND|OR|NOT)\s+\([^)]+\))*/;
      const simpleMatch = text.match(directQueryRegex);
      
      if (simpleMatch && simpleMatch[0].length > 30) {
        console.log(`Consulta PubMed extraída (método directo): "${simpleMatch[0].substring(0, 50)}..."`);
        return simpleMatch[0];
      }
      
      // Buscar expresiones tipo MeSH
      const meshTermRegex = /"[^"]+"\s*\[\s*(?:Mesh|MeSH|mesh|tiab|Title\/Abstract)\s*\]/;
      if (text.match(meshTermRegex)) {
        // Encontrar el bloque de texto que tenga estructura de consulta PubMed
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.match(meshTermRegex) && line.length > 20) {
            // Verificar si es parte de un bloque de consulta con paréntesis
            const cleanLine = line.trim();
            if (cleanLine.startsWith('(') || cleanLine.includes(' AND ') || cleanLine.includes(' OR ')) {
              console.log(`Consulta PubMed extraída (línea MeSH): "${cleanLine.substring(0, 50)}..."`);
              return cleanLine;
            }
          }
        }
      }
      
      // Si encontramos el texto "Estrategia de búsqueda:" seguido de consulta PubMed
      const estrategiaMatch = text.match(/Estrategia de búsqueda:[\s\n]*(\([^]*?\)(?:\s+(?:AND|OR|NOT)\s+\([^)]+\))*)/i);
      if (estrategiaMatch && estrategiaMatch[1] && estrategiaMatch[1].length > 30) {
        console.log(`Consulta PubMed extraída (sección estrategia): "${estrategiaMatch[1].substring(0, 50)}..."`);
        return estrategiaMatch[1].trim();
      }
      
      // Si todo lo anterior falla, devolver una consulta simple basada en palabras clave
      const keywords = text.split(/\s+/)
        .map(word => word.replace(/[^\w]/g, ''))
        .filter(word => word.length > 3)
        .slice(0, 5)
        .map(word => `"${word}"`)
        .join(' OR ');
        
      if (keywords) {
        console.log(`No se pudo extraer consulta estructurada, usando keywords: (${keywords})`);
        return `(${keywords})`;
      }
      
      // Si no se pudo extraer nada, devolver el texto original limitado
      console.log('No se pudo extraer consulta, retornando texto original truncado');
      return text.substring(0, 200);
    };
    
    // Si la estrategia es muy corta o no contiene términos de búsqueda, usarla directamente
    if (strategy.length < 30 || 
        (!strategy.includes('"') && !strategy.includes('[') && !strategy.includes('(')) ||
        (!strategy.includes('AND') && !strategy.includes('OR'))) {
      console.log('Estrategia simple, usando sin cambios');
      return extractPubMedQuery(strategy);
    }
    
    try {
      // Buscar la estrategia estructurada
      let extractedStrategy = '';
      
      // Eliminar prefijos comunes que podrían interferir con la búsqueda
      const prefixesToRemove = [
        'La estrategia de búsqueda refinada sería:',
        'La estrategia refinada sería:',
        'La estrategia de búsqueda sería:',
        'Estrategia de búsqueda:',
        'Estrategia refinada:',
        'Estrategia:',
        'Análisis PICO:'
      ];
      
      let cleanedStrategy = strategy;
      
      for (const prefix of prefixesToRemove) {
        if (cleanedStrategy.startsWith(prefix)) {
          cleanedStrategy = cleanedStrategy.substring(prefix.length).trim();
        }
      }
      
      // Método 1: Extraer directamente una secuencia de búsqueda PubMed estructurada
      const pubmedPattern = /\(\(?"[^"]+(?:\[(?:Mesh|MeSH|tiab)\][^\)]*\)|\))\s+(?:AND|OR|NOT)\s+\((?:[^()]*|\([^()]*\))*\)/;
      const pubmedMatch = cleanedStrategy.match(pubmedPattern);
      if (pubmedMatch && pubmedMatch[0] && pubmedMatch[0].length > 40) {
        extractedStrategy = pubmedMatch[0];
        console.log(`Estrategia extraída (método directo): "${extractedStrategy.substring(0, 100)}${extractedStrategy.length > 100 ? '...' : ''}"`);
      }
      
      // Si no se encontró estrategia, usar el método de extracción PubMed
      if (!extractedStrategy) {
        extractedStrategy = extractPubMedQuery(cleanedStrategy);
      }
      
      // Si no se encontró estrategia estructurada, usar la original pero solo la primera parte
      if (!extractedStrategy) {
        console.log('No se pudo extraer estrategia estructurada, usando estrategia original');
        // Limitar a los primeros 250 caracteres para evitar enviar todo el análisis
        const maxLength = 250;
        return strategy.substring(0, maxLength);
      }
      
      // Verificar y corregir problemas comunes en la estrategia de búsqueda
      
      // 1. Asegurar que los paréntesis estén balanceados
      const openParens = (extractedStrategy.match(/\(/g) || []).length;
      const closeParens = (extractedStrategy.match(/\)/g) || []).length;
      
      if (openParens !== closeParens) {
        console.log(`Paréntesis desbalanceados: ${openParens} abiertos, ${closeParens} cerrados`);
        // Si faltan de cierre, agregarlos al final
        if (openParens > closeParens) {
          extractedStrategy = extractedStrategy + ")".repeat(openParens - closeParens);
        }
        // Si faltan de apertura, agregarlos al inicio
        else if (closeParens > openParens) {
          extractedStrategy = "(".repeat(closeParens - openParens) + extractedStrategy;
        }
      }
      
      // 2. Asegurar que los operadores booleanos estén en mayúsculas
      extractedStrategy = extractedStrategy
        .replace(/\s+and\s+/gi, " AND ")
        .replace(/\s+or\s+/gi, " OR ")
        .replace(/\s+not\s+/gi, " NOT ");
      
      // 3. Asegurar que las comillas estén balanceadas
      const openQuotes = (extractedStrategy.match(/"/g) || []).length;
      if (openQuotes % 2 !== 0) {
        console.log(`Comillas desbalanceadas: ${openQuotes}`);
        // Si hay un número impar, agregar una comilla al final
        extractedStrategy = extractedStrategy + '"';
      }
      
      console.log('Estrategia validada y optimizada');
      return extractedStrategy;
    } catch (error) {
      console.error('Error al validar estrategia de búsqueda:', error);
      console.log('Usando estrategia original debido al error');
      // En caso de error, usar solo los primeros 200 caracteres para evitar enviar todo el texto
      return strategy.substring(0, 200);
    }
  },

  /**
   * Prioriza artículos según su relevancia para la consulta
   * @param {Array} articles - Artículos a priorizar
   * @param {string} question - Pregunta clínica
   * @param {Object} iCiteMetrics - Métricas de iCite para los artículos (opcional)
   * @returns {Array} - Artículos priorizados con puntuación
   */
  _prioritizeArticles(articles, question, iCiteMetrics = {}) {
    const method = 'prioritizeArticles';
    
    console.log(`Priorizando ${articles.length} artículos para la pregunta: "${question}"`);
    
    // Extraer términos clave de la pregunta
    const keywords = question.toLowerCase()
      .replace(/[.,?!;:()]/g, '')
      .split(' ')
      .filter(word => word.length > 3)
      .map(word => word.trim());
      
    console.log('Términos clave extraídos:', keywords);

    const scoredArticles = articles.map(article => {
      let score = 0;
      
      // 1. Tipo de estudio (meta-análisis, revisión sistemática, etc.)
      if (article.title) {
        const lowerTitle = article.title.toLowerCase();
        if (lowerTitle.includes('meta-analysis') || lowerTitle.includes('metaanalysis') || 
            lowerTitle.includes('metanálisis')) {
          score += 30;
          console.log(`Artículo PMID ${article.pmid}: +30 puntos por ser meta-análisis`);
        } else if (lowerTitle.includes('systematic review') || lowerTitle.includes('revisión sistemática')) {
          score += 25;
          console.log(`Artículo PMID ${article.pmid}: +25 puntos por ser revisión sistemática`);
        } else if (lowerTitle.includes('review') || lowerTitle.includes('revisión')) {
          score += 15;
          console.log(`Artículo PMID ${article.pmid}: +15 puntos por ser revisión`);
        } else if (lowerTitle.includes('randomized') || lowerTitle.includes('randomised') || 
                  lowerTitle.includes('aleatorizado')) {
          score += 10;
          console.log(`Artículo PMID ${article.pmid}: +10 puntos por ser estudio aleatorizado`);
        }
      }
      
      // 2. Calidad de diseño basada en términos MeSH
      if (article.meshTerms && Array.isArray(article.meshTerms)) {
        const qualityIndicators = ['double-blind', 'placebo-controlled', 'multicenter'];
        qualityIndicators.forEach(indicator => {
          if (article.meshTerms.some(term => term.toLowerCase().includes(indicator))) {
            score += 5;
            console.log(`Artículo PMID ${article.pmid}: +5 puntos por incluir término de calidad: ${indicator}`);
          }
        });
      }
      
      // 3. Actualidad del estudio
      if (article.publicationDate) {
        const yearMatch = article.publicationDate.match(/\b(20\d{2})\b/);
        if (yearMatch) {
          const year = parseInt(yearMatch[1]);
          const currentYear = new Date().getFullYear();
          const yearsOld = currentYear - year;
          
          // Artículos más recientes reciben mayor puntuación
          if (yearsOld <= 2) {
            score += 20;
            console.log(`Artículo PMID ${article.pmid}: +20 puntos por ser muy reciente (${year})`);
          } else if (yearsOld <= 5) {
            score += 15;
            console.log(`Artículo PMID ${article.pmid}: +15 puntos por ser reciente (${year})`);
          } else if (yearsOld <= 10) {
            score += 5;
            console.log(`Artículo PMID ${article.pmid}: +5 puntos por ser relativamente reciente (${year})`);
          }
        }
      }
      
      // 4. Relevancia basada en keywords en título y abstract
      if (article.title) {
        keywords.forEach(keyword => {
          if (article.title.toLowerCase().includes(keyword)) {
            score += 3;
            console.log(`Artículo PMID ${article.pmid}: +3 puntos por keyword en título: ${keyword}`);
          }
        });
      }
      
      if (article.abstract) {
        keywords.forEach(keyword => {
          if (article.abstract.toLowerCase().includes(keyword)) {
            score += 1;
            console.log(`Artículo PMID ${article.pmid}: +1 punto por keyword en abstract: ${keyword}`);
          }
        });
      }
      
      // 5. Revistas reconocidas
      const prestigiousJournals = [
        'nejm', 'new england', 'lancet', 'jama', 'bmj', 'british medical',
        'annals of internal medicine', 'nature', 'science', 'cell',
        'circulation', 'ophthalmology', 'journal of clinical',
        'american journal', 'journal of', 'archives of'
      ];
      
      if (article.source) {
        const lowerSource = article.source.toLowerCase();
        for (const journal of prestigiousJournals) {
          if (lowerSource.includes(journal)) {
            score += 7;
            console.log(`Artículo PMID ${article.pmid}: +7 puntos por revista prestigiosa: ${article.source}`);
            break;
          }
        }
      }

      // 6. NUEVO: Métricas de iCite si están disponibles
      if (iCiteMetrics && article.pmid && iCiteMetrics[article.pmid]) {
        const metrics = iCiteMetrics[article.pmid];
        
        // RCR (Relative Citation Ratio) - 40% del peso
        if (metrics.rcr !== null && metrics.rcr !== undefined) {
          const rcrScore = Math.min(metrics.rcr * 10, 40); // Valor RCR multiplicado por 10, máximo 40 puntos
          score += rcrScore;
          console.log(`Artículo PMID ${article.pmid}: +${rcrScore.toFixed(2)} puntos por RCR: ${metrics.rcr}`);
        }
        
        // APT (Approximate Potential to Translate) - 30% del peso
        if (metrics.apt !== null && metrics.apt !== undefined) {
          const aptScore = metrics.apt * 0.3; // APT convertido a puntaje, máximo 30 puntos
          score += aptScore;
          console.log(`Artículo PMID ${article.pmid}: +${aptScore.toFixed(2)} puntos por APT: ${metrics.apt}`);
        }
        
        // Citas clínicas - 20% del peso
        if (metrics.clinical_citations !== undefined) {
          // Escalar citas clínicas (máximo 20 puntos para ≥50 citas)
          const clinicalScore = Math.min(metrics.clinical_citations / 2.5, 20);
          score += clinicalScore;
          console.log(`Artículo PMID ${article.pmid}: +${clinicalScore.toFixed(2)} puntos por ${metrics.clinical_citations} citas clínicas`);
        }
        
        // Citas totales - 10% del peso
        if (metrics.citation_count !== undefined) {
          // Escalar citas totales (máximo 10 puntos para ≥100 citas)
          const citationScore = Math.min(metrics.citation_count / 10, 10);
          score += citationScore;
          console.log(`Artículo PMID ${article.pmid}: +${citationScore.toFixed(2)} puntos por ${metrics.citation_count} citas totales`);
        }
      }

      return {
        ...article,
        priorityScore: score
      };
    });

    // Ordenar artículos por puntuación (mayor a menor)
    scoredArticles.sort((a, b) => b.priorityScore - a.priorityScore);
    
    console.log(`Priorización completada. Artículo con mayor puntaje: PMID ${scoredArticles[0]?.pmid} (${scoredArticles[0]?.priorityScore.toFixed(2)} puntos)`);
    
    return scoredArticles;
  },

  /**
   * Calcula métricas para estrategias de búsqueda
   * @param {Array} initialResults - Resultados iniciales más sensibles
   * @param {Array} refinedResults - Resultados refinados más específicos
   * @returns {Object} - Métricas calculadas
   */
  _calculateSearchMetrics(initialResults, refinedResults) {
    // Si no hay resultados, devolver valores por defecto
    if (!initialResults || !initialResults.length) {
      return {
        sensitivity: 0,
        specificity: 0,
        precision: 0,
        nnr: 0
      };
    }
    
    // Si no hay resultados refinados, establecer los mismos que los iniciales
    if (!refinedResults || !refinedResults.length) {
      refinedResults = initialResults;
    }
    
    // Calcular métricas
    const totalInitial = initialResults.length;
    const totalRefined = refinedResults.length;
    
    // Número necesario a leer (NNR)
    const nnr = totalInitial > 0 ? Math.ceil(totalInitial / Math.max(totalRefined, 1)) : 0;
    
    // Sensibilidad (cantidad de artículos recuperados / total posible)
    // Como no conocemos el total posible, estimamos con un valor relativo
    const sensitivity = totalInitial > 0 ? 1.0 : 0;
    
    // Precisión (artículos relevantes / total recuperados)
    // Estimamos relevancia usando los resultados refinados
    const precision = totalInitial > 0 ? totalRefined / totalInitial : 0;
    
    // Especificidad (estimada en base a la precisión)
    const specificity = precision > 0 ? precision : 0;
    
    return {
      sensitivity: Math.round(sensitivity * 100),
      specificity: Math.round(specificity * 100),
      precision: Math.round(precision * 100),
      nnr: nnr
    };
  },

  /**
   * Controlador principal para procesar consultas científicas
   * @param {Object} req - Solicitud HTTP
   * @param {Object} res - Respuesta HTTP
   */
  async processQuery(req, res) {
    const method = 'processQuery';
    const startTime = Date.now();
    let queryId = null;
    
    try {
      console.log(`===== INICIANDO CONSULTA CIENTÍFICA =====`);
      // Extraer datos de la solicitud
      const { question, useAI = true, searchStrategy = "" } = req.body;
      
      console.log(`Pregunta: "${question}"`);
      console.log(`Usar IA: ${useAI}`);
      console.log(`Estrategia de búsqueda proporcionada: ${searchStrategy ? "Sí" : "No"}`);
      
      if (!question) {
        throw { type: errorTypes.BAD_REQUEST, message: "Se requiere una pregunta clínica" };
      }

      // Registrar la consulta
      queryId = queryLogger.startProcess(question, useAI);

      // PASO 1: Analizar la pregunta con Claude si useAI es true
      console.log("PASO 1: Analizando pregunta clínica");
      queryLogger.phaseInfo(queryId, "PASO_1", "Analizando pregunta clínica");
      
      let finalStrategy = searchStrategy;
      if (useAI && !searchStrategy) {
        try {
          console.log("Generando estrategia de búsqueda con Claude");
          finalStrategy = await claudeService.generateSearchStrategy(question);
          console.log(`Estrategia generada: "${finalStrategy}"`);
          queryLogger.phaseInfo(queryId, "PASO_1", "Estrategia generada con Claude", finalStrategy);
        } catch (error) {
          console.error("Error generando estrategia de búsqueda:", error);
          queryLogger.phaseError(queryId, "PASO_1", "Error generando estrategia de búsqueda", error);
          // Si falla Claude, usamos la pregunta original
          finalStrategy = question;
        }
      } else if (!searchStrategy) {
        // Si no se usa IA y no hay estrategia, usamos la pregunta original
        finalStrategy = question;
        queryLogger.phaseInfo(queryId, "PASO_1", "Usando pregunta original como estrategia");
      }

      // Validar y optimizar la estrategia
      const originalStrategy = finalStrategy;
      finalStrategy = scientificQueryController._validateSearchStrategy(finalStrategy);
      console.log(`Estrategia original: "${originalStrategy?.substring(0, 100)}${originalStrategy?.length > 100 ? '...' : ''}"`);
      console.log(`Estrategia final validada: "${finalStrategy}"`);
      queryLogger.phaseInfo(queryId, "PASO_1", "Estrategia validada", finalStrategy);

      // PASO 2: Búsqueda inicial en PubMed (alta sensibilidad)
      console.log("PASO 2: Realizando búsqueda inicial en PubMed");
      queryLogger.phaseInfo(queryId, "PASO_2", "Iniciando búsqueda en PubMed");
      
      const stepStartTime = Date.now();
      // Aumentar a 30 artículos
      const initialResults = await pubmedService.search(finalStrategy, 30);
      const stepEndTime = Date.now();
      
      console.log(`Resultados iniciales: ${initialResults.length} artículos`);
      queryLogger.phaseInfo(queryId, "PASO_2", `Búsqueda completada: ${initialResults.length} artículos`);
      queryLogger.phaseTime(queryId, "PASO_2", stepStartTime, stepEndTime);

      // Si no hay resultados, intenta con una consulta más simple basada en palabras clave
      let refinedStrategy = finalStrategy;
      let refinedResults = [];
      
      if (initialResults.length === 0) {
        console.log("No se encontraron resultados con la estrategia inicial. Intentando con palabras clave simples.");
        
        // Extraer palabras clave de la pregunta
        const keywords = question.toLowerCase()
          .replace(/[.,?!;:()]/g, '')
          .split(' ')
          .filter(word => word.length > 3)
          .slice(0, 5)
          .map(word => `"${word}"`)
          .join(' OR ');
          
        if (keywords) {
          const keywordStrategy = `(${keywords})`;
          console.log(`Estrategia basada en palabras clave: "${keywordStrategy}"`);
          
          try {
            console.log("Realizando búsqueda con palabras clave simples");
            const keywordResults = await pubmedService.search(keywordStrategy, 20);
            console.log(`Resultados con palabras clave: ${keywordResults.length} artículos`);
            
            if (keywordResults.length > 0) {
              refinedStrategy = keywordStrategy;
              refinedResults = keywordResults;
              console.log("Usando resultados de palabras clave como resultados principales");
            }
          } catch (error) {
            console.error("Error en búsqueda con palabras clave:", error);
          }
        }
      } else {
        // PASO 3: Generar una estrategia más específica con CLAUDE usando resultados iniciales
        console.log("PASO 3: Generando estrategia refinada");
        queryLogger.phaseInfo(queryId, "PASO_3", "Generando estrategia refinada");
        
        if (useAI && initialResults.length > 0) {
          try {
            // Preparar información para Claude
            const initialArticleInfo = initialResults.map(article => ({
              pmid: article.pmid,
              title: article.title,
              abstract: article.abstract?.substring(0, 300) + '...'  // Resumen truncado
            }));
            
            // Generar estrategia refinada
            console.log("Solicitando estrategia refinada a Claude");
            const promptData = {
              question,
              initialStrategy: finalStrategy,
              initialResults: initialArticleInfo
            };
            
            const refineStartTime = Date.now();
            // Este método debe implementarse en claudeService
            refinedStrategy = await claudeService.generateRefinedStrategy(promptData);
            const refineEndTime = Date.now();
            
            // Validar la estrategia refinada para evitar problemas
            refinedStrategy = scientificQueryController._validateSearchStrategy(refinedStrategy);
            
            console.log(`Estrategia refinada: "${refinedStrategy}"`);
            queryLogger.phaseInfo(queryId, "PASO_3", "Estrategia refinada generada", refinedStrategy);
            queryLogger.phaseTime(queryId, "PASO_3", refineStartTime, refineEndTime);
            
            // Realizar búsqueda refinada si la estrategia es diferente
            if (refinedStrategy && refinedStrategy !== finalStrategy) {
              console.log("PASO 4: Realizando búsqueda refinada");
              queryLogger.phaseInfo(queryId, "PASO_4", "Iniciando búsqueda refinada", refinedStrategy);
              
              const refinedSearchStart = Date.now();
              refinedResults = await pubmedService.search(refinedStrategy, 20);
              const refinedSearchEnd = Date.now();
              
              console.log(`Resultados refinados: ${refinedResults.length} artículos`);
              queryLogger.phaseInfo(queryId, "PASO_4", `Búsqueda refinada completada: ${refinedResults.length} artículos`);
              queryLogger.phaseTime(queryId, "PASO_4", refinedSearchStart, refinedSearchEnd);
              
            } else {
              console.log("La estrategia refinada es idéntica a la inicial, omitiendo búsqueda adicional");
              queryLogger.phaseInfo(queryId, "PASO_4", "Omitiendo búsqueda refinada, estrategia idéntica");
              refinedResults = initialResults;
            }
          } catch (error) {
            console.error("Error generando estrategia refinada:", error);
            queryLogger.phaseError(queryId, "PASO_3", "Error generando estrategia refinada", error);
            // Si hay error, usamos los resultados iniciales
            refinedResults = initialResults;
          }
        } else {
          // Si no usamos IA o no hay resultados iniciales, usamos los resultados iniciales
          queryLogger.phaseInfo(queryId, "PASO_4", "Omitiendo búsqueda refinada, usando resultados iniciales");
          refinedResults = initialResults;
        }
      }
      
      // Usar los resultados disponibles (iniciales o refinados)
      const resultsToUse = refinedResults.length > 0 ? refinedResults : initialResults;
      
      // Si aún no hay resultados, devolver respuesta vacía pero success: true
      if (resultsToUse.length === 0) {
        console.log("No se encontraron resultados en ninguna búsqueda");
        const emptyResponse = {
          success: true,
          query: question,
          initialStrategy: finalStrategy,
          refinedStrategy: refinedStrategy !== finalStrategy ? refinedStrategy : null,
          searchMetrics: { sensitivity: 0, specificity: 0, precision: 0, nnr: 0 },
          articles: [], // Para compatibilidad con versiones anteriores
          processTimeMs: Date.now() - startTime
        };
        queryLogger.endProcess(queryId, true, 0);
        return res.status(200).json(emptyResponse);
      }
      
      // PASO 5: Obtener métricas de iCite para los artículos
      console.log("PASO 5: Obteniendo métricas de iCite");
      queryLogger.phaseInfo(queryId, "PASO_5", "Obteniendo métricas de iCite");
      
      let iCiteMetrics = {};
      try {
        // Extraer PMIDs de todos los artículos
        const allPmids = [...new Set([
          ...initialResults.map(a => a.pmid),
          ...refinedResults.map(a => a.pmid)
        ])].filter(Boolean);
        
        if (allPmids.length > 0) {
          console.log(`Consultando métricas de iCite para ${allPmids.length} PMIDs`);
          
          const iciteStartTime = Date.now();
          iCiteMetrics = await iCiteService.getMetricsForPmids(allPmids);
          const iciteEndTime = Date.now();
          
          console.log(`Métricas obtenidas para ${Object.keys(iCiteMetrics).length} PMIDs`);
          queryLogger.phaseInfo(queryId, "PASO_5", `Métricas obtenidas para ${Object.keys(iCiteMetrics).length} PMIDs`);
          queryLogger.phaseTime(queryId, "PASO_5", iciteStartTime, iciteEndTime);
        }
      } catch (error) {
        console.error("Error obteniendo métricas de iCite:", error);
        queryLogger.phaseError(queryId, "PASO_5", "Error obteniendo métricas de iCite", error);
        // Continuamos sin métricas de iCite
      }

      // PASO 6: Priorizar artículos
      console.log("PASO 6: Priorizando artículos");
      queryLogger.phaseInfo(queryId, "PASO_6", "Priorizando artículos");
      
      const prioritizeStartTime = Date.now();
      const prioritizedArticles = scientificQueryController._prioritizeArticles(resultsToUse, question, iCiteMetrics);
      const prioritizeEndTime = Date.now();
      
      queryLogger.phaseInfo(queryId, "PASO_6", `Priorización completada: ${prioritizedArticles.length} artículos`);
      queryLogger.phaseTime(queryId, "PASO_6", prioritizeStartTime, prioritizeEndTime);
      
      // PASO 7: Enriquecer artículos con métricas adicionales
      prioritizedArticles.forEach(article => {
        // Añadir métricas de iCite si están disponibles
        if (iCiteMetrics[article.pmid]) {
          article.iCiteMetrics = iCiteMetrics[article.pmid];
        }
      });
      
      // PASO 8: Calcular métricas de búsqueda
      const searchMetrics = scientificQueryController._calculateSearchMetrics(initialResults, refinedResults);
      console.log("Métricas de búsqueda:", searchMetrics);
      queryLogger.phaseInfo(queryId, "PASO_8", "Métricas de búsqueda calculadas", searchMetrics);

      // PASO 9: Analizar los artículos más relevantes con Claude si useAI es true
      let articleAnalysis = [];
      console.log("PASO 9: Analizando artículos con Claude");
      queryLogger.phaseInfo(queryId, "PASO_9", "Analizando artículos con Claude");
      
      if (useAI && prioritizedArticles.length > 0) {
        try {
          // Seleccionar los artículos más relevantes (máximo 5)
          const topArticles = prioritizedArticles.slice(0, 5);
          console.log(`Analizando ${topArticles.length} artículos principales con Claude`);
          
          // Crear un lote de análisis
          const analysisStartTime = Date.now();
          articleAnalysis = await claudeService.analyzeArticleBatch(topArticles, question);
          const analysisEndTime = Date.now();
          
          console.log(`Análisis completado para ${articleAnalysis.length} artículos`);
          queryLogger.phaseInfo(queryId, "PASO_9", `Análisis completado para ${articleAnalysis.length} artículos`);
          queryLogger.phaseTime(queryId, "PASO_9", analysisStartTime, analysisEndTime);
          
        } catch (error) {
          console.error("Error analizando artículos con Claude:", error);
          queryLogger.phaseError(queryId, "PASO_9", "Error analizando artículos con Claude", error);
          // Continuamos sin análisis de artículos
        }
      } else {
        queryLogger.phaseInfo(queryId, "PASO_9", "Omitiendo análisis de artículos");
      }
      
      // PASO 10: Integrar análisis con los artículos
      console.log("PASO 10: Integrando análisis con artículos");
      queryLogger.phaseInfo(queryId, "PASO_10", "Integrando análisis con artículos");
      
      // Crear mapa de análisis para búsqueda rápida por PMID
      const analysisMap = {};
      articleAnalysis.forEach(analysis => {
        if (analysis.pmid) {
          analysisMap[analysis.pmid] = analysis;
        }
      });
      
      // Integrar análisis en los artículos priorizados
      const articlesWithAnalysis = prioritizedArticles.map(article => {
        if (analysisMap[article.pmid]) {
          return {
            ...article,
            analysis: analysisMap[article.pmid]
          };
        }
        return article;
      });

      // PASO 11: Preparar respuesta
      const endTime = Date.now();
      const response = {
        success: true,
        query: question,
        initialStrategy: finalStrategy,
        refinedStrategy: refinedStrategy !== finalStrategy ? refinedStrategy : null,
        searchMetrics,
        articles: articlesWithAnalysis, // Para compatibilidad con versiones anteriores
        results: articlesWithAnalysis,  // Requerido por el frontend
        processTimeMs: endTime - startTime
      };
      
      console.log(`===== CONSULTA CIENTÍFICA COMPLETADA EN ${endTime - startTime}ms =====`);
      queryLogger.endProcess(queryId, true, articlesWithAnalysis.length);
      
      // Enviar respuesta
      return res.status(200).json(response);
      
    } catch (error) {
      const endTime = Date.now();
      console.error(`===== ERROR EN CONSULTA CIENTÍFICA (${endTime - startTime}ms) =====`);
      console.error(error);
      
      // Registrar error en el logger si tenemos un queryId
      if (queryId) {
        queryLogger.phaseError(queryId, "ERROR", "Error procesando consulta científica", error);
        queryLogger.endProcess(queryId, false);
      }
      
      const statusCode = error.type === errorTypes.BAD_REQUEST ? 400 : 500;
      const errorMessage = error.message || "Error procesando consulta científica";
      
      return res.status(statusCode).json({
        success: false,
        error: errorMessage
      });
    }
  },
  
  /**
   * Busca artículos en PubMed utilizando una estrategia de búsqueda
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función para pasar al siguiente middleware
   */
  searchArticles: async (req, res, next) => {
    try {
      const { query, searchStrategy, maxResults = 10 } = req.body;
      
      if (!query && !searchStrategy) {
        return next(errorTypes.badRequest('Se requiere una consulta o estrategia de búsqueda'));
      }
      
      // Usar estrategia de búsqueda si está disponible, de lo contrario usar consulta
      const searchQuery = searchStrategy || query;
      
      console.log(`Realizando búsqueda en PubMed: "${searchQuery}"`);
      const articles = await pubmedService.search(searchQuery, maxResults);
      
      console.log(`Encontrados ${articles.length} artículos`);
      
      return res.status(200).json({
        success: true,
        query: searchQuery,
        count: articles.length,
        results: articles
      });
    } catch (error) {
      console.error('Error al buscar artículos:', error);
      return next(error);
    }
  },
  
  /**
   * Obtiene detalles completos de un artículo específico por PMID
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función para pasar al siguiente middleware
   */
  getArticleDetails: async (req, res, next) => {
    try {
      const { pmid } = req.params;
      
      if (!pmid) {
        return next(errorTypes.badRequest('Se requiere un PMID válido'));
      }
      
      console.log(`Obteniendo detalles del artículo PMID: ${pmid}`);
      const article = await pubmedService.getArticleByPmid(pmid);
      
      if (!article) {
        return next(errorTypes.notFound(`No se encontró artículo con PMID: ${pmid}`));
      }
      
      return res.status(200).json({
        success: true,
        result: article
      });
    } catch (error) {
      console.error('Error al obtener detalles del artículo:', error);
      return next(error);
    }
  },
  
  /**
   * Analiza un artículo específico utilizando IA
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   * @param {Function} next - Función para pasar al siguiente middleware
   */
  analyzeArticle: async (req, res, next) => {
    try {
      const { pmid, question } = req.body;
      
      if (!pmid) {
        return next(errorTypes.badRequest('Se requiere un PMID válido'));
      }
      
      if (!question) {
        return next(errorTypes.badRequest('Se requiere una pregunta clínica para el análisis'));
      }
      
      console.log(`Obteniendo y analizando artículo PMID: ${pmid}`);
      
      // Obtener artículo
      const article = await pubmedService.getArticleByPmid(pmid);
      
      if (!article) {
        return next(errorTypes.notFound(`No se encontró artículo con PMID: ${pmid}`));
      }
      
      // Analizar con IA
      console.log('Realizando análisis con IA...');
      const analysis = await claudeService.analyzeArticle(article, question);
      
      // Incluir análisis en el artículo
      const analyzedArticle = {
        ...article,
        secondaryAnalysis: analysis
      };
      
      return res.status(200).json({
        success: true,
        result: analyzedArticle
      });
    } catch (error) {
      console.error('Error al analizar artículo:', error);
      return next(error);
    }
  }
};

export default scientificQueryController; 