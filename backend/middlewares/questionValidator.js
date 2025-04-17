import claudeService from '../services/claudeService.js';

// Middleware para validar preguntas científicas

export const validateQuestion = (req, res, next) => {
  const { question } = req.body;
  
  if (!question || typeof question !== 'string' || question.trim().length < 5) {
    return res.status(400).json({
      success: false,
      message: 'La pregunta debe tener al menos 5 caracteres'
    });
  }
  
  // Si todo está bien, continuamos
  next();
};

export const validateQuestionAI = async (req, res, next) => {
  try {
    const { question, useAI } = req.body;

    // Validaciones básicas
    if (!question) {
      return res.status(400).json({ error: 'La pregunta es requerida' });
    }

    if (question.length < 10) {
      return res.status(400).json({ error: 'La pregunta es demasiado corta' });
    }

    // Si el toggle de IA está activado, validamos con Claude
    if (useAI) {
      // Creamos un prompt específico para validación
      const validationPrompt = `
        Eres Claude, un asistente experto en investigación científica médica.
        
        Evalúa si la siguiente pregunta es pertinente y está correctamente formulada para una búsqueda científica médica:
        "${question}"
        
        Responde únicamente con un objeto JSON con el siguiente formato:
        {
          "isValid": boolean,
          "message": string (explicación si no es válida, vacío si es válida)
        }
      `;
      
      const validationResponse = await claudeService.generateResponse(validationPrompt);
      
      try {
        const validation = JSON.parse(validationResponse);
        
        if (!validation.isValid) {
          return res.status(400).json({ 
            error: 'La pregunta no es válida para una búsqueda científica', 
            message: validation.message 
          });
        }
      } catch (parseError) {
        console.error('Error al parsear respuesta de validación:', parseError);
        // En caso de error de parseo, continuamos y asumimos que la pregunta es válida
      }
    }

    next();
  } catch (error) {
    console.error('Error en middleware de validación:', error);
    res.status(500).json({ error: 'Error al validar la pregunta' });
  }
}; 