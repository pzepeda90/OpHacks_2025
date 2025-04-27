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
   * Procesa una consulta científica
   * @param {Object} req - Objeto de solicitud Express
   * @param {Object} res - Objeto de respuesta Express
   */
  async processQuery(req, res) {
    try {
      const { question, useAI = true } = req.body;
      
      if (!question) {
        return res.status(400).json({
          success: false, 
          message: 'Se requiere una pregunta científica'
        });
      }
      
      console.log(`Procesando consulta científica: "${question}"`);
      console.log(`Uso de IA: ${useAI ? 'Habilitado' : 'Deshabilitado'}`);
      
      // Variable para almacenar la estrategia generada
      let searchStrategy = '';
      
      // Generar estrategia de búsqueda con IA si está habilitado
      if (useAI) {
        console.log('Generando estrategia de búsqueda con IA...');
        try {
          const claudeResponse = await claudeService.generateSearchStrategy(question);
          searchStrategy = claudeResponse;
          console.log(`Estrategia generada: "${searchStrategy.substring(0, 100)}..."`);
          
          // Validar y optimizar la estrategia
          searchStrategy = scientificQueryController._validateSearchStrategy(searchStrategy);
          
        } catch (aiError) {
          console.error('Error al generar estrategia con IA:', aiError);
          console.log('Usando texto de la pregunta como estrategia de respaldo');
          searchStrategy = question;
        }
      } else {
        console.log('Usando texto de la pregunta como estrategia');
        searchStrategy = question;
      }
      
      // Ejecutar búsqueda en PubMed
      console.log(`Buscando artículos con la estrategia: "${searchStrategy.substring(0, 100)}..."`);
      const articles = await pubmedService.search(searchStrategy);
      console.log(`Se encontraron ${articles.length} artículos`);

      // === ENRIQUECIMIENTO CON iCite ===
      // Obtener los PMIDs de los artículos encontrados
      const pmidList = articles.map(a => a.pmid).filter(Boolean);
      let iciteDataMap = {};
      if (pmidList.length > 0) {
        try {
          const iciteService = (await import('../services/iciteService.js')).default;
          const iciteResults = await iciteService.getByPmids(pmidList);
          // Mapear por PMID para acceso rápido
          if (Array.isArray(iciteResults)) {
            iciteDataMap = Object.fromEntries(iciteResults.map(item => [String(item.pmid), item]));
          } else if (iciteResults && iciteResults.pmid) {
            iciteDataMap = { [String(iciteResults.pmid)]: iciteResults };
          }
        } catch (err) {
          console.error('Error al consultar/enriquecer con iCite:', err);
        }
      }
      // Enriquecer los artículos con los datos de iCite si existen
      const enrichedArticles = articles.map(article => {
        const icite = iciteDataMap[String(article.pmid)];
        return icite ? { ...article, ...icite } : article;
      });

      // Si se usa IA y hay artículos, priorizar y analizar los más relevantes
      let analyzedArticles = enrichedArticles;
      if (useAI && enrichedArticles.length > 0) {
        console.log('Priorizando artículos según relevancia...');
        try {
          // Priorizar artículos según relevancia
          const prioritizedArticles = scientificQueryController._prioritizeArticles(enrichedArticles, question);
          
          // Determinar cuántos artículos analizar en profundidad (máximo 5)
          const maxToAnalyze = Math.min(5, prioritizedArticles.length);
          const articlesToAnalyze = prioritizedArticles.slice(0, maxToAnalyze);
          const remainingArticles = prioritizedArticles.slice(maxToAnalyze);
          
          console.log(`Analizando en profundidad ${maxToAnalyze} artículos prioritarios de ${prioritizedArticles.length} totales`);
          
          // Analizar los artículos priorizados
          let analyzedPriority = [];
          let failedAnalyses = 0;
          
          for (let i = 0; i < articlesToAnalyze.length; i++) {
            const article = articlesToAnalyze[i];
            console.log(`Analizando artículo prioritario ${i+1}/${maxToAnalyze}: PMID ${article.pmid} (Score: ${article.priorityScore})`);
            
            try {
              const analysis = await claudeService.analyzeArticle(article, question);
              
              analyzedPriority.push({
                ...article,
                secondaryAnalysis: analysis,
                fullyAnalyzed: true
              });
              
              console.log(`Análisis completado para artículo PMID ${article.pmid}`);
              
            } catch (analysisError) {
              console.error(`Error al analizar artículo PMID ${article.pmid}:`, analysisError);
              failedAnalyses++;
              
              analyzedPriority.push({
                ...article,
                secondaryAnalysis: `Error en análisis: ${analysisError.message}`,
                analysisError: true,
                fullyAnalyzed: false
              });
            }
          }
          
          // Combinar los artículos analizados con los no analizados
          analyzedArticles = [
            ...analyzedPriority,
            ...remainingArticles.map(article => ({
              ...article,
              fullyAnalyzed: false,
              secondaryAnalysis: "Este artículo no fue seleccionado para análisis detallado debido a su menor relevancia para la consulta."
            }))
          ];
          
          console.log(`Análisis completado: ${analyzedPriority.length - failedAnalyses} exitosos, ${failedAnalyses} fallidos, ${remainingArticles.length} no analizados`);
          
        } catch (analysisError) {
          console.error('Error general al priorizar/analizar artículos:', analysisError);
          console.log('Devolviendo artículos sin análisis');
        }
      }
      
      // Preparar respuesta
      const response = {
        success: true,
        question,
        searchStrategy,
        articlesFound: articles.length,
        articles: analyzedArticles
      };
      
      console.log('Consulta procesada exitosamente');
      return res.status(200).json(response);
    } catch (error) {
      console.error('Error al procesar consulta científica:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Error interno del servidor'
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