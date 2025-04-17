import claudeService from '../services/claudeService.js';
import pubmedService from '../utils/pubmed.js';

// Controlador temporal para consultas científicas

export const processScientificQuery = async (req, res) => {
  try {
    const { question, useAI } = req.body;
    
    console.log('Procesando consulta científica:', question);
    console.log('Usar IA:', useAI);
    
    // Simular procesamiento
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    res.json({
      success: true,
      message: 'Consulta procesada correctamente',
      results: []
    });
  } catch (error) {
    console.error('Error al procesar consulta científica:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar consulta',
      error: error.message
    });
  }
};

export const processScientificQueryOld = async (req, res) => {
  try {
    console.log('=============================================');
    console.log('NUEVA CONSULTA CIENTÍFICA RECIBIDA');
    console.log('=============================================');
    
    const { question, useAI } = req.body;
    console.log(`IP Cliente: ${req.ip || 'No disponible'}`);
    console.log(`Headers: ${JSON.stringify(req.headers['user-agent'] || 'No disponible')}`);
    console.log(`Pregunta recibida: "${question}"`);
    console.log(`Uso de IA activado: ${useAI ? 'SÍ' : 'NO'}`);
    console.log('---------------------------------------------');
    
    let processedQuestion;
    let pubmedQuery;
    
    // Procesar la pregunta con IA si useAI está activado
    if (useAI) {
      console.log('>> INICIANDO PROCESAMIENTO CON CLAUDE <<');
      try {
        console.log('Enviando pregunta a Claude para análisis PICO y traducción...');
        // Generamos la estrategia de búsqueda
        const searchStrategy = await claudeService.generateSearchStrategy(question);
        
        // Creamos un objeto con la información procesada
        processedQuestion = {
          pico: {
            population: "Extraído por Claude",
            intervention: "Extraído por Claude",
            comparator: "Extraído por Claude",
            outcome: "Extraído por Claude"
          },
          translatedQuestion: question, // Claude ya traduce en su prompt
          searchStrategy: searchStrategy
        };
        
        console.log('Respuesta de Claude recibida:');
        console.log(`- PICO población: ${processedQuestion.pico?.population || 'No identificado'}`);
        console.log(`- PICO intervención: ${processedQuestion.pico?.intervention || 'No identificado'}`);
        console.log(`- PICO comparador: ${processedQuestion.pico?.comparator || 'No identificado'}`);
        console.log(`- PICO outcome: ${processedQuestion.pico?.outcome || 'No identificado'}`);
        console.log(`- Traducción: "${processedQuestion.translatedQuestion}"`);
        
        pubmedQuery = processedQuestion.searchStrategy;
        console.log(`- Estrategia de búsqueda generada: "${pubmedQuery}"`);
      } catch (error) {
        console.error('ERROR EN PROCESAMIENTO CON CLAUDE:');
        console.error(`- Mensaje: ${error.message}`);
        console.error(`- Stack: ${error.stack}`);
        return res.status(500).json({ 
          error: 'Error al procesar la pregunta con IA',
          details: error.message
        });
      }
    } else {
      // Si no se usa IA, usamos la pregunta directamente como consulta
      pubmedQuery = question;
      console.log('Modo sin IA: usando pregunta original como consulta');
      console.log(`- Query para PubMed: "${pubmedQuery}"`);
    }
    
    // Buscar en PubMed
    console.log('---------------------------------------------');
    console.log('>> INICIANDO CONSULTA A PUBMED <<');
    let pubmedResults;
    try {
      console.log(`Enviando consulta a PubMed API: "${pubmedQuery}"`);
      const startTime = Date.now();
      pubmedResults = await pubmedService.search(pubmedQuery);
      const endTime = Date.now();
      console.log(`Tiempo de respuesta de PubMed: ${endTime - startTime}ms`);
      console.log(`Resultados obtenidos: ${pubmedResults?.length || 0} artículos`);
      
      if (pubmedResults && pubmedResults.length > 0) {
        console.log('Muestra de resultados (primeros 2):');
        pubmedResults.slice(0, 2).forEach((result, idx) => {
          console.log(`[${idx + 1}] PMID: ${result.pmid}, Título: "${result.title.substring(0, 50)}..."`);
          console.log(`    Fecha: ${result.publicationDate}, MeSH Terms: ${result.meshTerms.slice(0, 3).join(', ')}...`);
        });
      }
    } catch (error) {
      console.error('ERROR EN CONSULTA A PUBMED:');
      console.error(`- Mensaje: ${error.message}`);
      console.error(`- Stack: ${error.stack}`);
      return res.status(500).json({
        error: 'Error al consultar PubMed',
        details: error.message,
        originalQuestion: question,
        processedQuestion: useAI ? processedQuestion : null
      });
    }
    
    // Si no hay resultados, retornar mensaje apropiado
    if (!pubmedResults || pubmedResults.length === 0) {
      console.log('No se encontraron resultados en PubMed para esta consulta');
      return res.status(200).json({
        message: 'No se encontraron resultados para la consulta',
        results: [],
        originalQuestion: question,
        processedQuestion: useAI ? processedQuestion : null,
        pubmedQuery: pubmedQuery
      });
    }
    
    // Analizar resultados con IA si useAI está activado
    let analyzedResults = pubmedResults;
    
    if (useAI) {
      console.log('---------------------------------------------');
      console.log('>> INICIANDO ANÁLISIS DE RESULTADOS CON CLAUDE <<');
      let analyzedArticles = [];
      try {
        console.log(`Enviando ${pubmedResults.length} resultados a Claude para análisis...`);
        const startTime = Date.now();
        
        // Procesar cada artículo en paralelo
        const analyzedResultsPromises = pubmedResults.map(article => 
          claudeService.analyzeArticle(article, question)
        );
        
        // Esperar a que todos los análisis se completen
        const analysisResults = await Promise.all(analyzedResultsPromises);
        
        // Combinar los resultados originales con el análisis
        analyzedResults = pubmedResults.map((article, index) => {
          // Intentar extraer puntuación del análisis
          const analysisText = analysisResults[index];
          const scoreMatch = analysisText.match(/puntuación: (\d)\/5/i) || 
                            analysisText.match(/calificación: (\d)\/5/i) ||
                            analysisText.match(/score: (\d)\/5/i) || 
                            analysisText.match(/(\d)\/5/);
          
          const score = scoreMatch ? parseInt(scoreMatch[1]) : 3; // Default a 3 si no se encuentra
          
          console.log(`- PMID ${article.pmid}: Score ${score}/5`);
          
          return {
            ...article,
            relevanceScore: score,
            analysisExplanation: analysisText
          };
        });
        
        const endTime = Date.now();
        console.log(`Tiempo de respuesta de análisis Claude: ${endTime - startTime}ms`);
        
        // Ordenar por puntuación de relevancia
        analyzedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
        console.log('Resultados ordenados por relevancia');
        console.log('Top 3 resultados después de ordenar:');
        analyzedResults.slice(0, 3).forEach((result, idx) => {
          console.log(`[${idx + 1}] PMID: ${result.pmid}, Score: ${result.relevanceScore}, Título: "${result.title.substring(0, 40)}..."`);
        });
      } catch (error) {
        console.error('ERROR EN ANÁLISIS CON CLAUDE:');
        console.error(`- Mensaje: ${error.message}`);
        console.error(`- Stack: ${error.stack}`);
        // Continuamos con los resultados sin análisis en caso de error
        analyzedResults = pubmedResults.map(article => ({
          ...article,
          relevanceScore: 0,
          analysisExplanation: 'Error en el análisis de IA'
        }));
      }
    }
    
    // Responder con los resultados estructurados
    console.log('---------------------------------------------');
    console.log('>> ENVIANDO RESPUESTA AL CLIENTE <<');
    console.log(`Total de resultados enviados: ${analyzedResults.length}`);
    console.log('=============================================');
    
    res.status(200).json({
      message: 'Consulta procesada exitosamente',
      results: analyzedResults,
      originalQuestion: question,
      processedQuestion: useAI ? processedQuestion : null,
      pubmedQuery: pubmedQuery,
      totalResults: analyzedResults.length
    });
    
  } catch (error) {
    console.error('=============================================');
    console.error('ERROR GENERAL EN PROCESAMIENTO DE CONSULTA:');
    console.error(`- Mensaje: ${error.message}`);
    console.error(`- Stack: ${error.stack}`);
    console.error('=============================================');
    
    res.status(500).json({ 
      error: 'Error al procesar la consulta científica',
      details: error.message || 'Error desconocido'
    });
  }
}; 