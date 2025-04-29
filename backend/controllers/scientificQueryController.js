/**
 * Controlador para las consultas científicas
 * Coordina los servicios de PubMed y Claude para procesar consultas
 */
import pubmedService from '../services/pubmedService.js';
import claudeService from '../services/claudeService.js';
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
    
    // Si la estrategia es muy corta o no contiene términos de búsqueda, usarla directamente
    if (strategy.length < 30 || 
        (!strategy.includes('"') && !strategy.includes('[') && !strategy.includes('(')) ||
        (!strategy.includes('AND') && !strategy.includes('OR'))) {
      console.log('Estrategia simple, usando sin cambios');
      return strategy;
    }
    
    try {
      // Buscar la estrategia estructurada
      let extractedStrategy = '';
      
      // Método 1: Buscar sección "ESTRATEGIA DE BÚSQUEDA COMPLETA"
      if (strategy.includes('ESTRATEGIA DE BÚSQUEDA')) {
        // Buscar patrones comunes que indiquen el inicio de la estrategia de búsqueda
        const estrategiaPatterns = [
          /ESTRATEGIA DE BÚSQUEDA COMPLETA:[\s\n]*(\((?:[^()]*|\([^()]*\))*\)(?:\s+(?:AND|OR|NOT)\s+\((?:[^()]*|\([^()]*\))*\))*)/i,
          /ESTRATEGIA DE BÚSQUEDA(?:\s+COMPLETA)?:[\s\n]*(\((?:[^()]*|\([^()]*\))*\)(?:\s+(?:AND|OR|NOT)\s+\((?:[^()]*|\([^()]*\))*\))*)/i,
          /PUBMED SEARCH STRATEGY:[\s\n]*(\((?:[^()]*|\([^()]*\))*\)(?:\s+(?:AND|OR|NOT)\s+\((?:[^()]*|\([^()]*\))*\))*)/i
        ];
        
        for (const pattern of estrategiaPatterns) {
          const match = strategy.match(pattern);
          if (match && match[1] && match[1].length > 30) {
            extractedStrategy = match[1].trim();
            console.log(`Estrategia extraída (método 1): "${extractedStrategy.substring(0, 100)}${extractedStrategy.length > 100 ? '...' : ''}"`);
            break;
          }
        }
      }
      
      // Método 2: Buscar estructura de búsqueda con paréntesis y operadores booleanos
      if (!extractedStrategy) {
        // Buscar un patrón que incluya términos MeSH y operadores booleanos
        const meshPattern = /\(\s*"[^"]+"\s*(?:\[[^\]]+\])(?:\s+OR\s+(?:"[^"]+"\s*(?:\[[^\]]+\])))*\)(?:\s+AND\s+\(.+?\))*/g;
        const matches = [...strategy.matchAll(meshPattern)];
        
        if (matches && matches.length > 0) {
          // Encontrar la coincidencia más larga (probablemente la estrategia completa)
          const longestMatch = matches.reduce((longest, match) => 
            match[0].length > longest.length ? match[0] : longest, "");
          
          if (longestMatch && longestMatch.length > 40) {
            extractedStrategy = longestMatch;
            console.log(`Estrategia extraída (método 2): "${extractedStrategy.substring(0, 100)}${extractedStrategy.length > 100 ? '...' : ''}"`);
          }
        }
      }
      
      // Método 3: Buscar en líneas individuales
      if (!extractedStrategy) {
        const lines = strategy.split('\n');
        for (const line of lines) {
          // Buscar líneas que contengan estructura de búsqueda PubMed
          if ((line.includes('[MeSH') || line.includes('[Mesh]') || line.includes('[tiab]')) && 
              (line.includes('AND') || line.includes('OR')) && 
              line.includes('(') && line.includes(')') && 
              line.length > 50) {
            extractedStrategy = line.trim();
            console.log(`Estrategia extraída (método 3): "${extractedStrategy.substring(0, 100)}${extractedStrategy.length > 100 ? '...' : ''}"`);
            break;
          }
        }
      }
      
      // Si no se encontró estrategia estructurada, usar la original
      if (!extractedStrategy) {
        console.log('No se pudo extraer estrategia estructurada, usando estrategia original');
        return strategy;
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
      return strategy;
    }
  },

  /**
   * Prioriza artículos según su relevancia para la consulta
   * @param {Array} articles - Artículos a priorizar
   * @param {string} question - Pregunta clínica
   * @returns {Array} - Artículos priorizados con puntuación
   */
  _prioritizeArticles(articles, question) {
    const method = 'prioritizeArticles';
    console.log(`Priorizando ${articles.length} artículos para la pregunta: "${question}"`);

    // Extraer términos clave de la pregunta
    const keywords = question.toLowerCase()
      .replace(/[.,?!;:()]/g, '')
      .split(' ')
      .filter(word => word.length > 3)
      .map(word => word.trim());
    console.log('Términos clave extraídos:', keywords);

    const prestigiousJournals = [
      'nejm', 'new england', 'lancet', 'jama', 'bmj', 'british medical',
      'annals of internal medicine', 'nature', 'science', 'cell',
      'circulation', 'ophthalmology', 'journal of clinical',
      'american journal', 'journal of', 'archives of'
    ];

    const scoredArticles = articles.map(article => {
      let score = 0;
      let log = [];

      // 1️⃣ Calidad Metodológica (20 pts)
      // Tipo de estudio (máx. 15 pts)
      let tipoEstudio = 0;
      if (article.title) {
        const lowerTitle = article.title.toLowerCase();
        if (lowerTitle.includes('meta-analysis') || lowerTitle.includes('metaanalysis') || lowerTitle.includes('metanálisis')) {
          tipoEstudio = 15; log.push('+15 meta-análisis');
        } else if (lowerTitle.includes('systematic review') || lowerTitle.includes('revisión sistemática')) {
          tipoEstudio = 12; log.push('+12 revisión sistemática');
        } else if (lowerTitle.includes('review') || lowerTitle.includes('revisión')) {
          tipoEstudio = 7; log.push('+7 revisión narrativa');
        } else if (lowerTitle.includes('randomized') || lowerTitle.includes('randomised') || lowerTitle.includes('aleatorizado')) {
          tipoEstudio = 10; log.push('+10 estudio aleatorizado');
        } else if (lowerTitle.includes('cohort') || lowerTitle.includes('caso-control') || lowerTitle.includes('case-control')) {
          tipoEstudio = 5; log.push('+5 cohorte/caso-control');
        }
      }
      score += tipoEstudio;
      // Diseño MeSH (máx. 5 pts)
      let meshScore = 0;
      if (article.meshTerms && Array.isArray(article.meshTerms)) {
        const qualityIndicators = ['double-blind', 'placebo-controlled', 'multicenter'];
        qualityIndicators.forEach(indicator => {
          if (article.meshTerms.some(term => term.toLowerCase().includes(indicator))) {
            meshScore += 2;
            log.push('+2 MeSH: ' + indicator);
          }
        });
        meshScore = Math.min(meshScore, 5);
      }
      score += meshScore;

      // 2️⃣ Impacto Científico (30 pts)
      // RCR (15 pts)
      let rcr = parseFloat(article.relative_citation_ratio);
      if (!isNaN(rcr)) {
        if (rcr > 2.0) { score += 15; log.push('+15 RCR>2.0'); }
        else if (rcr >= 1.5) { score += 12; log.push('+12 RCR 1.5-2.0'); }
        else if (rcr >= 1.0) { score += 8; log.push('+8 RCR 1.0-1.49'); }
        else if (rcr >= 0.5) { score += 4; log.push('+4 RCR 0.5-0.99'); }
        else { score += 1; log.push('+1 RCR<0.5'); }
      }
      // NIH Percentil (10 pts)
      let perc = parseFloat(article.nih_percentile);
      if (!isNaN(perc)) {
        if (perc > 90) { score += 10; log.push('+10 NIH%>90'); }
        else if (perc >= 75) { score += 7; log.push('+7 NIH% 75-90'); }
        else if (perc >= 50) { score += 4; log.push('+4 NIH% 50-74'); }
        else { score += 1; log.push('+1 NIH%<50'); }
      }
      // Citas por año (5 pts)
      let cpy = parseFloat(article.citations_per_year);
      if (!isNaN(cpy)) {
        if (cpy >= 10) { score += 5; log.push('+5 ≥10 citas/año'); }
        else if (cpy >= 5) { score += 3; log.push('+3 5-10 citas/año'); }
        else if (cpy >= 1) { score += 1; log.push('+1 1-4 citas/año'); }
      }

      // 3️⃣ Actualidad (10 pts)
      let year = null;
      if (article.year) year = parseInt(article.year);
      else if (article.publicationDate) {
        const yearMatch = String(article.publicationDate).match(/\b(20\d{2})\b/);
        if (yearMatch) year = parseInt(yearMatch[1]);
      }
      if (year) {
        const currentYear = new Date().getFullYear();
        const yearsOld = currentYear - year;
        if (yearsOld <= 2) { score += 10; log.push('+10 ≤2 años'); }
        else if (yearsOld <= 5) { score += 7; log.push('+7 ≤5 años'); }
        else if (yearsOld <= 10) { score += 3; log.push('+3 ≤10 años'); }
      }

      // 4️⃣ Aplicabilidad Clínica (15 pts)
      let apt = parseFloat(article.apt);
      if (!isNaN(apt)) {
        if (apt > 0.8) { score += 15; log.push('+15 APT>0.8'); }
        else if (apt >= 0.6) { score += 10; log.push('+10 APT 0.6-0.8'); }
        else if (apt >= 0.4) { score += 5; log.push('+5 APT 0.4-0.59'); }
        else { score += 1; log.push('+1 APT<0.4'); }
      }

      // 5️⃣ Relevancia Temática (20 pts)
      // Coincidencia keywords en título (12 pts)
      let kwTitle = 0;
      if (article.title) {
        const lowerTitle = article.title.toLowerCase();
        keywords.forEach(keyword => {
          if (lowerTitle.includes(keyword)) kwTitle += 3;
        });
        kwTitle = Math.min(kwTitle, 12);
        if (kwTitle > 0) log.push(`+${kwTitle} keywords en título`);
      }
      score += kwTitle;
      // Coincidencia keywords en abstract (8 pts)
      let kwAbs = 0;
      if (article.abstract) {
        const lowerAbs = article.abstract.toLowerCase();
        keywords.forEach(keyword => {
          if (lowerAbs.includes(keyword)) kwAbs += 1;
        });
        kwAbs = Math.min(kwAbs, 8);
        if (kwAbs > 0) log.push(`+${kwAbs} keywords en abstract`);
      }
      score += kwAbs;

      // 6️⃣ Prestigio Revista (5 pts)
      let journal = article.journal || article.source || '';
      if (journal) {
        const lowerSource = journal.toLowerCase();
        for (const j of prestigiousJournals) {
          if (lowerSource.includes(j)) {
            score += 5; log.push('+5 revista prestigiosa');
            break;
          }
        }
      }

      // Limitar score máximo a 100
      score = Math.min(score, 100);
      return {
        ...article,
        priorityScore: score,
        scoreLog: log
      };
    });

    // Ordenar artículos por puntuación de mayor a menor
    const prioritizedArticles = scoredArticles.sort((a, b) => b.priorityScore - a.priorityScore);
    // Mostrar resumen de priorización
    console.log(`=== RESUMEN DE PRIORIZACIÓN ===`);
    prioritizedArticles.forEach((article, index) => {
      console.log(`${index + 1}. PMID: ${article.pmid}, Score: ${article.priorityScore}, Título: ${article.title?.substring(0, 50)}...`, article.scoreLog);
    });
    return prioritizedArticles;
  },

  /**
   * Procesa una consulta científica con un flujo optimizado de 3 etapas
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  processQuery: async (req, res) => {
    const { question, strategy, useAI = true } = req.body;
    const startTime = Date.now();
    let processAlert = null;
    const progressLog = [];

    // Función para registrar el progreso con timestamp
    const logProgress = (stage, message) => {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${stage}: ${message}`;
      console.log(logEntry);
      progressLog.push(logEntry);
    };

    try {
      logProgress('INICIO', `Procesando consulta: "${question.substring(0, 100)}..."`);
      
      // === PRIMER DESTILADO: Generando estrategia PICO ===
      logProgress('ETAPA 1', 'Generando estrategia de búsqueda PICO');
      
      let searchStrategy;
      let fullResponseStrategy;
      
      if (strategy) {
        // Si el usuario ya proporcionó una estrategia, usarla
        logProgress('ETAPA 1', 'Usando estrategia proporcionada por el usuario');
        searchStrategy = strategy;
        fullResponseStrategy = strategy;
        
        // Validar la estrategia proporcionada
        searchStrategy = scientificQueryController._validateSearchStrategy(strategy);
      } else if (useAI) {
        try {
          // Generar estrategia usando Claude
          logProgress('ETAPA 1', 'Solicitando estrategia a Claude');
          const strategyResponse = await claudeService.generateSearchStrategy(question);
          
          if (typeof strategyResponse === 'object' && strategyResponse.strategy) {
            searchStrategy = strategyResponse.strategy;
            fullResponseStrategy = strategyResponse.fullResponse;
            logProgress('ETAPA 1', `Estrategia generada (${searchStrategy.length} caracteres)`);
          } else if (typeof strategyResponse === 'string') {
            // Compatibilidad con versiones anteriores
            searchStrategy = strategyResponse;
            fullResponseStrategy = strategyResponse;
            logProgress('ETAPA 1', `Estrategia generada en formato antiguo (${searchStrategy.length} caracteres)`);
          } else {
            throw new Error('Formato de respuesta de estrategia no reconocido');
          }
          
          // Validar y optimizar la estrategia generada
          searchStrategy = scientificQueryController._validateSearchStrategy(searchStrategy);
        } catch (strategyError) {
          logProgress('ERROR', `Error al generar estrategia: ${strategyError.message}`);
          // Usar la pregunta directamente como fallback
          searchStrategy = question;
          fullResponseStrategy = question;
          processAlert = 'No se pudo generar una estrategia estructurada. Se utilizó la pregunta clínica como búsqueda.';
        }
      } else {
        // Si no se proporciona estrategia y no se usa AI, usar la pregunta directamente
        logProgress('ETAPA 1', 'Usando pregunta como estrategia (AI desactivada)');
        searchStrategy = question;
        fullResponseStrategy = question;
      }

      if (!searchStrategy || searchStrategy.trim().length < 5) {
        throw new Error('Estrategia de búsqueda vacía o inválida');
      }

      // === SEGUNDO DESTILADO: Búsqueda básica y filtrado por títulos ===
      logProgress('ETAPA 2', 'Ejecutando búsqueda básica en PubMed (solo títulos)');
      
      // Realizar búsqueda básica inicial (no recuperar abstracts todavía)
      let articles = [];
      try {
        articles = await pubmedService.search(searchStrategy);
        logProgress('ETAPA 2', `Búsqueda completada: ${articles.length} artículos encontrados`);
      } catch (searchError) {
        logProgress('ERROR', `Error en búsqueda: ${searchError.message}`);
        throw new Error(`Error al buscar en PubMed: ${searchError.message}`);
      }
      
      if (!articles || articles.length === 0) {
        logProgress('ETAPA 2', 'No se encontraron artículos');
        return res.status(200).json({
          success: true,
          message: 'No se encontraron artículos para la estrategia proporcionada',
          searchStrategy,
          fullResponseStrategy,
          articles: [],
          logs: progressLog
        });
      }
      
      // Registrar los PMIDs encontrados para diagnóstico
      logProgress('ETAPA 2', `PMIDs encontrados: ${articles.slice(0, 10).map(a => a.pmid).join(', ')}${articles.length > 10 ? '...' : ''}`);
      
      // SECOND STAGE: Distillation #1 - Filtrar artículos por título
      try {
        if (articles.length > 10) {
          console.log(`[processQuery] Filtrando artículos por título relevancia (${articles.length} disponibles)`);
          const startTime = Date.now();
          // Filtrar artículos por título para reducir tokens en pasos posteriores
          articles = await claudeService.filterByTitles(articles, question, { limit: 20 });
          console.log(`[processQuery] Filtrado completado: ${articles.length} artículos seleccionados en ${Date.now() - startTime}ms`);
        }
      } catch (error) {
        console.error(`[processQuery] Error al filtrar artículos por título: ${error.message}`);
        // Continuamos con los artículos que tenemos
      }
      
      // Ahora recuperar abstracts solo para artículos relevantes
      logProgress('ETAPA 2', `Recuperando abstracts para ${articles.length} artículos relevantes`);
      let articlesWithAbstracts = [];
      
      try {
        // Solo recuperar abstracts para los artículos que pasaron el filtro de título
        if (articles.length > 0) {
          // Extraer PMIDs
          const pmids = articles.map(article => article.pmid);
          logProgress('ETAPA 2', `Solicitando abstracts para ${pmids.length} artículos`);
          
          // Obtener artículos completos con abstracts
          const completeArticles = await pubmedService.getAbstractsForArticles(articles);
          articlesWithAbstracts = completeArticles.filter(article => article && article.abstract);
          
          logProgress('ETAPA 2', `Abstracts recuperados: ${articlesWithAbstracts.length}/${articles.length}`);
        }
      } catch (abstractError) {
        logProgress('ERROR', `Error al recuperar abstracts: ${abstractError.message}`);
        // Usar artículos sin abstracts si hay error
        articlesWithAbstracts = articles;
        processAlert = 'Hubo un problema al recuperar algunos abstracts. Se utilizaron los artículos disponibles.';
      }
      
      // === TERCER DESTILADO: Enriquecimiento con iCite y análisis final ===
      logProgress('ETAPA 3', 'Enriqueciendo artículos con datos bibliométricos (iCite)');
      
      // Enriquecer con iCite
      let enrichedArticles = articlesWithAbstracts;
      
      try {
        // Extraer PMIDs para consulta a iCite
        const pmidList = articlesWithAbstracts.map(a => a.pmid).filter(Boolean);
        
        if (pmidList.length > 0) {
          logProgress('ETAPA 3', `Consultando iCite para ${pmidList.length} PMIDs`);
          const iciteService = (await import('../services/iciteService.js')).default;
          const iciteResults = await iciteService.getByPmids(pmidList);
          
          // Crear un mapa para acceso rápido
          let iciteDataMap = {};
          if (Array.isArray(iciteResults)) {
            iciteDataMap = Object.fromEntries(iciteResults.map(item => [String(item.pmid), item]));
            logProgress('ETAPA 3', `Datos iCite obtenidos para ${Object.keys(iciteDataMap).length}/${pmidList.length} artículos`);
          } else if (iciteResults && iciteResults.pmid) {
            iciteDataMap = { [String(iciteResults.pmid)]: iciteResults };
            logProgress('ETAPA 3', `Datos iCite obtenidos para 1 artículo`);
          }
          
          // Enriquecer artículos con datos de iCite
          enrichedArticles = articlesWithAbstracts.map(article => {
            const icite = iciteDataMap[String(article.pmid)];
            return icite ? { ...article, ...icite } : article;
          });
        }
      } catch (iciteError) {
        logProgress('ERROR', `Error al enriquecer con iCite: ${iciteError.message}`);
        // Continuar con los artículos sin enriquecimiento
        processAlert = 'No se pudieron obtener datos bibliométricos de iCite. Los resultados pueden ser menos precisos.';
      }
      
      // Priorizar artículos
      logProgress('ETAPA 3', `Calculando relevancia para ${enrichedArticles.length} artículos`);
      const prioritizedArticles = scientificQueryController._prioritizeArticles(enrichedArticles, question);
      
      // Analizar solo los artículos más relevantes
      const topArticlesToAnalyze = 5;
      const topArticles = prioritizedArticles.slice(0, topArticlesToAnalyze);
      logProgress('ETAPA 3', `Seleccionados ${topArticles.length} artículos principales para análisis detallado`);
      
      // Analizar artículos principales
      const analyzedArticles = [];
      let successfulAnalyses = 0;
      let failedAnalyses = 0;
      
      if (useAI && topArticles.length > 0) {
        for (let i = 0; i < topArticles.length; i++) {
          const article = topArticles[i];
          logProgress('ETAPA 3', `Analizando artículo ${i + 1}/${topArticles.length}: PMID ${article.pmid}`);
          
          try {
            const analysis = await claudeService.analyzeArticle(article, question);
            analyzedArticles.push({
              ...article,
              analysis,
              analyzed: true
            });
            successfulAnalyses++;
            logProgress('ETAPA 3', `Análisis completado para PMID ${article.pmid}`);
          } catch (analysisError) {
            logProgress('ERROR', `Error al analizar PMID ${article.pmid}: ${analysisError.message}`);
            analyzedArticles.push({
              ...article,
              analysis: `Error en el análisis: ${analysisError.message}`,
              analyzed: false
            });
            failedAnalyses++;
          }
        }
      } else {
        logProgress('ETAPA 3', 'Omitiendo análisis detallado (AI desactivada o sin artículos)');
      }
      
      // Incluir artículos restantes sin análisis
      const remainingArticles = prioritizedArticles.slice(topArticlesToAnalyze).map(article => ({
        ...article,
        analysis: 'Este artículo no fue seleccionado para análisis detallado debido a su menor relevancia.',
        analyzed: false
      }));
      
      // Combinar todos los artículos para la respuesta final
      const finalArticles = [...analyzedArticles, ...remainingArticles];
      
      // Calcular estadísticas
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      logProgress('FIN', `Procesamiento completado en ${processingTime}ms. Artículos totales: ${finalArticles.length}, Analizados: ${successfulAnalyses}, Fallidos: ${failedAnalyses}`);
      
      // Devolver resultado
      return res.status(200).json({
        success: true,
        message: processAlert || 'Consulta procesada exitosamente',
        searchStrategy,
        fullResponseStrategy,
        articles: finalArticles,
        stats: {
          totalInitial: articles.length,
          afterFiltering: articles.length,
          withAbstracts: articlesWithAbstracts.length,
          analyzed: successfulAnalyses,
          failedAnalyses,
          processingTimeMs: processingTime
        },
        logs: progressLog
      });
    } catch (error) {
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      logProgress('ERROR', `Error general: ${error.message}`);
      logProgress('FIN', `Procesamiento terminado con error después de ${processingTime}ms`);
      
      return res.status(500).json({
        success: false,
        message: 'Error al procesar la consulta',
        error: error.message,
        logs: progressLog
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