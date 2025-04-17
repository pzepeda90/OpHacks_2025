/**
 * Script para probar el servicio de Claude
 */
import claudeService from './services/claudeService.js';

// Función principal de prueba
async function testClaude() {
  try {
    console.log('===========================================');
    console.log('PRUEBA DE CLAUDE');
    console.log('===========================================');
    
    // Prompt de prueba
    const prompt = `
      Por favor, resume en 2-3 párrafos qué es la medicina basada en la evidencia 
      y por qué es importante en la práctica clínica moderna.
    `;
    
    console.log('Enviando solicitud a Claude...');
    const response = await claudeService.generateResponse(prompt);
    
    console.log('===========================================');
    console.log('RESPUESTA:');
    console.log('===========================================');
    console.log(response);
    console.log('===========================================');
    
    // Prueba de estrategia de búsqueda
    const question = "¿Es efectiva la metformina para prevenir la diabetes tipo 2 en pacientes con prediabetes?";
    console.log('Generando estrategia de búsqueda para:', question);
    const strategy = await claudeService.generateSearchStrategy(question);
    
    console.log('===========================================');
    console.log('ESTRATEGIA DE BÚSQUEDA:');
    console.log('===========================================');
    console.log(strategy);
    console.log('===========================================');
    
  } catch (error) {
    console.error('ERROR:', error);
  }
}

// Ejecutar la prueba
testClaude(); 