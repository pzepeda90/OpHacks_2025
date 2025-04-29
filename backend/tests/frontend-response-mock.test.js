import { jest } from '@jest/globals';

// Mock de fetch global para las pruebas
global.fetch = jest.fn();

// Clase de servicio simplificada basada en el frontend para pruebas
class AIServiceMock {
  constructor() {
    this.apiUrl = '/api/claude';
  }
  
  async analyzeArticle(article, clinicalQuestion) {
    const methodName = 'analyzeArticle';
    try {
      console.log(`Analizando artículo: ${article.pmid || 'sin PMID'}`);
      
      if (!article || !clinicalQuestion) {
        throw new Error('Se requieren artículo y pregunta clínica');
      }

      // Validar y normalizar la propiedad authors
      const processedArticle = {...article};
      if (!processedArticle.authors) {
        processedArticle.authors = [];
      } else if (!Array.isArray(processedArticle.authors)) {
        if (typeof processedArticle.authors === 'string') {
          processedArticle.authors = [{ name: processedArticle.authors }];
        } else {
          processedArticle.authors = [];
        }
      }
      
      const response = await fetch(`${this.apiUrl}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          article: processedArticle, 
          clinicalQuestion 
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error en la solicitud: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      // Verificación más detallada de la respuesta para manejar diferentes estructuras de datos
      if (!data.success) {
        throw new Error(`El servidor indicó un error: ${data.message || 'Error desconocido'}`);
      }
      
      // Verificar si la respuesta tiene la estructura esperada
      if (data.analysis) {
        console.log('Análisis completado con éxito (formato estándar)');
        return data.analysis;
      } else if (data.content) {
        console.log('Análisis completado con éxito (formato alternativo)');
        return data.content;
      } else {
        console.log('Respuesta recibida pero sin contenido de análisis', data);
        
        // Verificar si hay algún otro campo que podría contener el análisis
        const possibleFields = ['result', 'secondaryAnalysis', 'text', 'html'];
        for (const field of possibleFields) {
          if (data[field] && typeof data[field] === 'string' && data[field].length > 0) {
            console.log(`Usando campo alternativo "${field}" para el análisis`);
            return data[field];
          }
        }
        
        // Si no podemos encontrar el análisis, crear una respuesta de error formateada
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
            <p>No fue posible analizar este artículo. Error: Formato de respuesta inválido</p>
          </div>
        </div>`;
      }
    } catch (error) {
      console.error('Error en análisis de artículo', error);
      
      // Devolver un mensaje de error formateado como HTML
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
          <p>No fue posible analizar este artículo. Error: ${error.message || 'Desconocido'}</p>
        </div>
      </div>`;
    }
  }
}

// Tests
describe('Manejo de errores de formato en el frontend', () => {
  let aiService;
  
  beforeEach(() => {
    aiService = new AIServiceMock();
    global.fetch.mockClear();
    console.log = jest.fn();
    console.error = jest.fn();
  });
  
  it('debería manejar respuesta con análisis en campo "analysis"', async () => {
    // Mock de respuesta con campo 'analysis'
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({
        success: true,
        analysis: '<div class="card-analysis">Análisis estándar</div>'
      })
    });
    
    const article = { pmid: '12345', title: 'Test' };
    const result = await aiService.analyzeArticle(article, 'Pregunta clínica');
    
    expect(result).toBe('<div class="card-analysis">Análisis estándar</div>');
    expect(console.log).toHaveBeenCalledWith('Análisis completado con éxito (formato estándar)');
  });
  
  it('debería manejar respuesta con análisis en campo "content"', async () => {
    // Mock de respuesta con campo 'content'
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({
        success: true,
        content: '<div class="card-analysis">Análisis en content</div>'
      })
    });
    
    const article = { pmid: '12345', title: 'Test' };
    const result = await aiService.analyzeArticle(article, 'Pregunta clínica');
    
    expect(result).toBe('<div class="card-analysis">Análisis en content</div>');
    expect(console.log).toHaveBeenCalledWith('Análisis completado con éxito (formato alternativo)');
  });
  
  it('debería manejar respuesta con análisis en campo alternativo', async () => {
    // Mock de respuesta con campo alternativo
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({
        success: true,
        secondaryAnalysis: '<div class="card-analysis">Análisis en campo alternativo</div>'
      })
    });
    
    const article = { pmid: '12345', title: 'Test' };
    const result = await aiService.analyzeArticle(article, 'Pregunta clínica');
    
    expect(result).toBe('<div class="card-analysis">Análisis en campo alternativo</div>');
    expect(console.log).toHaveBeenCalledWith('Usando campo alternativo "secondaryAnalysis" para el análisis');
  });
  
  it('debería manejar respuesta sin ningún campo de análisis', async () => {
    // Mock de respuesta sin campos de análisis
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({
        success: true,
        // No hay campos de análisis
      })
    });
    
    const article = { pmid: '12345', title: 'Test' };
    const result = await aiService.analyzeArticle(article, 'Pregunta clínica');
    
    expect(result).toContain('<span class="badge type">Error</span>');
    expect(result).toContain('ERROR DE ANÁLISIS');
    expect(result).toContain('Formato de respuesta inválido');
  });
  
  it('debería manejar error de red', async () => {
    // Mock de error de red
    global.fetch.mockRejectedValueOnce(new Error('Error de conexión'));
    
    const article = { pmid: '12345', title: 'Test' };
    const result = await aiService.analyzeArticle(article, 'Pregunta clínica');
    
    expect(result).toContain('<span class="badge type">Error</span>');
    expect(result).toContain('ERROR DE ANÁLISIS');
    expect(result).toContain('Error de conexión');
    expect(console.error).toHaveBeenCalled();
  });
  
  it('debería manejar respuesta HTTP de error', async () => {
    // Mock de respuesta HTTP de error
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: jest.fn().mockResolvedValueOnce('Rate limit exceeded')
    });
    
    const article = { pmid: '12345', title: 'Test' };
    const result = await aiService.analyzeArticle(article, 'Pregunta clínica');
    
    expect(result).toContain('<span class="badge type">Error</span>');
    expect(result).toContain('ERROR DE ANÁLISIS');
    expect(result).toContain('Error en la solicitud: 429');
    expect(console.error).toHaveBeenCalled();
  });
  
  it('debería manejar respuesta con success: false', async () => {
    // Mock de respuesta con éxito falso
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce({
        success: false,
        message: 'Error interno del servidor'
      })
    });
    
    const article = { pmid: '12345', title: 'Test' };
    const result = await aiService.analyzeArticle(article, 'Pregunta clínica');
    
    expect(result).toContain('<span class="badge type">Error</span>');
    expect(result).toContain('ERROR DE ANÁLISIS');
    expect(result).toContain('El servidor indicó un error: Error interno del servidor');
    expect(console.error).toHaveBeenCalled();
  });
}); 