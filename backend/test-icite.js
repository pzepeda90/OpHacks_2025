// Script para probar el servicio iCiteService
import iCiteService from './services/iciteService.js';

async function testICiteService() {
  try {
    console.log('Probando servicio iCiteService...');
    
    // Prueba 1: Obtener métricas para PMIDs específicos
    const pmids = ['27806745', '25035568'];
    console.log(`Obteniendo métricas para PMIDs: ${pmids.join(', ')}`);
    
    const metricas = await iCiteService.getMetricsForPmids(pmids);
    console.log('Métricas obtenidas:');
    console.log(JSON.stringify(metricas, null, 2));
    
    // Prueba 2: Calcular puntuación de relevancia
    if (metricas && metricas[pmids[0]]) {
      const score = iCiteService.calculateRelevanceScore(metricas[pmids[0]]);
      console.log(`Score calculado para PMID ${pmids[0]}: ${score}`);
    }
    
    console.log('Prueba completada exitosamente');
  } catch (error) {
    console.error('Error durante la prueba:', error);
  }
}

// Ejecutar la prueba
testICiteService(); 