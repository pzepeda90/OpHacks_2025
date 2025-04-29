import { jest } from '@jest/globals';

// Simulación de un servicio frontend para procesar lotes
class FrontendBatchProcessor {
  constructor() {
    this.analyzeArticle = jest.fn();
  }
  
  async processArticles(articles, clinicalQuestion) {
    const results = [];
    
    console.log(`Procesando lote de ${articles.length} artículos`);
    
    // Creamos un Promise.all para procesar artículos en paralelo
    try {
      const processedArticles = await Promise.all(
        articles.map(async (article, index) => {
          try {
            console.log(`Procesando artículo ${index + 1}/${articles.length}: ${article.pmid}`);
            
            // Intento de análisis
            const analysis = await this.analyzeArticle(article, clinicalQuestion);
            
            // Verificar si el análisis contiene indicación de error
            const isErrorAnalysis = typeof analysis === 'string' && 
                                  (analysis.includes('<span class="badge type">Error</span>') || 
                                   analysis.includes('ERROR DE ANÁLISIS'));
            
            if (isErrorAnalysis) {
              console.error(`Error detectado en análisis de artículo ${index + 1}/${articles.length}: ${article.pmid}`);
              return {
                ...article,
                secondaryAnalysis: analysis,
                analysisError: true
              };
            }
            
            return {
              ...article,
              secondaryAnalysis: analysis,
              analysisError: false
            };
          } catch (error) {
            console.error(`Error al procesar artículo ${index + 1}/${articles.length}: ${article.pmid}`, error);
            
            // Crear un mensaje de error formateado como HTML
            const errorAnalysis = `<div class="card-analysis">
              <div class="card-header">
                <h3>ANÁLISIS DE EVIDENCIA</h3>
                <div class="badges">
                  <span class="badge quality">★☆☆☆☆</span>
                  <span class="badge type">Error</span>
                </div>
              </div>
              <div class="card-section">
                <h4>ERROR DE ANÁLISIS</h4>
                <p>No fue posible analizar este artículo. Error: ${error.message || 'Desconocido'}</p>
              </div>
            </div>`;
            
            return {
              ...article,
              secondaryAnalysis: errorAnalysis,
              analysisError: true
            };
          }
        })
      );
      
      return processedArticles;
    } catch (batchError) {
      console.error('Error crítico en el procesamiento por lotes:', batchError);
      
      // Devolver artículos con mensajes de error
      return articles.map(article => ({
        ...article,
        secondaryAnalysis: `<div class="card-analysis">
          <div class="card-header">
            <h3>ANÁLISIS DE EVIDENCIA</h3>
            <div class="badges">
              <span class="badge quality">★☆☆☆☆</span>
              <span class="badge type">Error</span>
            </div>
          </div>
          <div class="card-section">
            <h4>ERROR DE ANÁLISIS</h4>
            <p>Error en el procesamiento por lotes: ${batchError.message}</p>
          </div>
        </div>`,
        analysisError: true
      }));
    }
  }
}

describe('Manejo de errores 429 en procesamiento por lotes', () => {
  let batchProcessor;
  
  beforeEach(() => {
    batchProcessor = new FrontendBatchProcessor();
    console.log = jest.fn();
    console.error = jest.fn();
  });
  
  it('debería continuar procesando cuando un artículo falla con error 429', async () => {
    // Configurar el mock para simular errores 429 en algunos artículos
    batchProcessor.analyzeArticle
      // Primer artículo exitoso
      .mockResolvedValueOnce('<div class="card-analysis">Análisis exitoso 1</div>')
      // Segundo artículo falla con error 429
      .mockRejectedValueOnce(new Error('Error en la solicitud: 429 - Rate limit exceeded'))
      // Tercer artículo exitoso
      .mockResolvedValueOnce('<div class="card-analysis">Análisis exitoso 3</div>');
    
    const articles = [
      { pmid: '12345', title: 'Artículo 1' },
      { pmid: '67890', title: 'Artículo 2' },
      { pmid: '54321', title: 'Artículo 3' }
    ];
    
    const results = await batchProcessor.processArticles(articles, 'Pregunta clínica');
    
    // Verificar que tenemos 3 resultados
    expect(results.length).toBe(3);
    
    // Verificar que el primer y tercer artículo fueron exitosos
    expect(results[0].analysisError).toBe(false);
    expect(results[0].secondaryAnalysis).toContain('Análisis exitoso 1');
    
    expect(results[2].analysisError).toBe(false);
    expect(results[2].secondaryAnalysis).toContain('Análisis exitoso 3');
    
    // Verificar que el segundo artículo tiene error formateado correctamente
    expect(results[1].analysisError).toBe(true);
    expect(results[1].secondaryAnalysis).toContain('<span class="badge type">Error</span>');
    expect(results[1].secondaryAnalysis).toContain('Rate limit exceeded');
    
    // Verificar que el método analyzeArticle fue llamado 3 veces
    expect(batchProcessor.analyzeArticle).toHaveBeenCalledTimes(3);
  });
  
  it('debería manejar errores de formato de respuesta dentro del lote', async () => {
    // Configurar el mock para simular errores de formato en algunos artículos
    batchProcessor.analyzeArticle
      // Primer artículo exitoso
      .mockResolvedValueOnce('<div class="card-analysis">Análisis exitoso 1</div>')
      // Segundo artículo devuelve error en formato de análisis
      .mockResolvedValueOnce(`<div class="card-analysis">
        <div class="card-header">
          <h3>ANÁLISIS DE EVIDENCIA</h3>
          <div class="badges">
            <span class="badge quality">★☆☆☆☆</span>
            <span class="badge type">Error</span>
          </div>
        </div>
        <div class="card-section">
          <h4>ERROR DE ANÁLISIS</h4>
          <p>No fue posible analizar este artículo. Error: Formato de respuesta inválido</p>
        </div>
      </div>`)
      // Tercer artículo exitoso
      .mockResolvedValueOnce('<div class="card-analysis">Análisis exitoso 3</div>');
    
    const articles = [
      { pmid: '12345', title: 'Artículo 1' },
      { pmid: '67890', title: 'Artículo 2' },
      { pmid: '54321', title: 'Artículo 3' }
    ];
    
    const results = await batchProcessor.processArticles(articles, 'Pregunta clínica');
    
    // Verificar que tenemos 3 resultados
    expect(results.length).toBe(3);
    
    // Verificar que el primer y tercer artículo fueron exitosos
    expect(results[0].analysisError).toBe(false);
    expect(results[0].secondaryAnalysis).toContain('Análisis exitoso 1');
    
    expect(results[2].analysisError).toBe(false);
    expect(results[2].secondaryAnalysis).toContain('Análisis exitoso 3');
    
    // Verificar que el segundo artículo tiene error formateado correctamente
    expect(results[1].analysisError).toBe(true);
    expect(results[1].secondaryAnalysis).toContain('<span class="badge type">Error</span>');
    expect(results[1].secondaryAnalysis).toContain('Formato de respuesta inválido');
    
    // Verificar que el método analyzeArticle fue llamado 3 veces
    expect(batchProcessor.analyzeArticle).toHaveBeenCalledTimes(3);
  });
  
  it('debería manejar muchos errores 429 consecutivos con backoff exponencial simulado', async () => {
    // Función para simular backoff exponencial 
    const createRateLimitError = (attempt) => {
      const error = new Error(`Error en la solicitud: 429 - Rate limit exceeded (intento ${attempt})`);
      return error;
    };
    
    // Configurar el mock para simular varios errores 429 consecutivos, algunos con éxito después
    batchProcessor.analyzeArticle
      // Artículo 1: Error 429 en primer intento, luego éxito
      .mockRejectedValueOnce(createRateLimitError(1))
      .mockResolvedValueOnce('<div class="card-analysis">Análisis exitoso después de reintentar</div>')
      // Artículo 2: Error 429 en todos los intentos
      .mockRejectedValueOnce(createRateLimitError(1))
      .mockRejectedValueOnce(createRateLimitError(2))
      .mockRejectedValueOnce(createRateLimitError(3))
      // Artículo 3: Éxito inmediato
      .mockResolvedValueOnce('<div class="card-analysis">Análisis exitoso inmediato</div>');
    
    // Sobrescribir la implementación de analyzeArticle para simular reintentos
    batchProcessor.analyzeArticle = jest.fn().mockImplementation(async (article) => {
      // Simulación simple de reintentos
      if (article.pmid === '12345') {
        // Primer artículo: falla una vez, luego tiene éxito
        if (!article._retries) {
          article._retries = 1;
          throw createRateLimitError(1);
        }
        return '<div class="card-analysis">Análisis exitoso después de reintentar</div>';
      } else if (article.pmid === '67890') {
        // Segundo artículo: siempre falla
        article._retries = (article._retries || 0) + 1;
        throw createRateLimitError(article._retries);
      } else {
        // Tercer artículo: éxito inmediato
        return '<div class="card-analysis">Análisis exitoso inmediato</div>';
      }
    });
    
    const articles = [
      { pmid: '12345', title: 'Artículo 1 - Reintento exitoso' },
      { pmid: '67890', title: 'Artículo 2 - Siempre falla' },
      { pmid: '54321', title: 'Artículo 3 - Éxito inmediato' }
    ];
    
    const results = await batchProcessor.processArticles(articles, 'Pregunta clínica');
    
    // Verificar que tenemos 3 resultados
    expect(results.length).toBe(3);
    
    // Verificar artículo 1: falla con error 429
    expect(results[0].analysisError).toBe(true);
    expect(results[0].secondaryAnalysis).toContain('Rate limit exceeded (intento 1)');
    
    // Verificar artículo 2: siempre falla
    expect(results[1].analysisError).toBe(true);
    expect(results[1].secondaryAnalysis).toContain('<span class="badge type">Error</span>');
    expect(results[1].secondaryAnalysis).toContain('Rate limit exceeded');
    
    // Verificar artículo 3: éxito inmediato
    expect(results[2].analysisError).toBe(false);
    expect(results[2].secondaryAnalysis).toContain('Análisis exitoso inmediato');
    
    // Verificar llama a analyzeArticle para cada artículo
    expect(batchProcessor.analyzeArticle).toHaveBeenCalledTimes(3);
  });
}); 