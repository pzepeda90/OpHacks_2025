/**
 * Utilidad para calcular y formatear métricas para estrategias de búsqueda científica
 */

/**
 * Calcula las métricas de rendimiento de una estrategia de búsqueda
 * @param {Object} metrics - Objeto con las métricas estimadas
 * @returns {Object} Objeto con las métricas formateadas y colores
 */
export const formatMetrics = (metrics) => {
  // Valores por defecto
  const defaults = {
    sensibilidad: 70,
    especificidad: 85,
    precision: 75,
    nnr: 4,
    saturacion: 80
  };

  // Combinar con valores por defecto si no existen
  const values = {
    sensibilidad: metrics.sensibilidad || defaults.sensibilidad,
    especificidad: metrics.especificidad || defaults.especificidad,
    precision: metrics.precision || defaults.precision,
    nnr: metrics.nnr || defaults.nnr,
    saturacion: metrics.saturacion || defaults.saturacion
  };

  // Determinar colores basados en rangos aceptables
  const colors = {
    sensibilidad: getColorForValue(values.sensibilidad, 60, 80),
    especificidad: getColorForValue(values.especificidad, 70, 90),
    precision: getColorForValue(values.precision, 65, 85),
    nnr: getColorForNNR(values.nnr),
    saturacion: getColorForValue(values.saturacion, 65, 85)
  };

  return {
    values,
    colors,
    badges: generateBadgesHTML(values, colors)
  };
};

/**
 * Extrae métricas del texto de respuesta de Claude
 * @param {string} responseText - Texto completo de la respuesta
 * @returns {Object} Métricas extraídas
 */
export const extractMetricsFromText = (responseText) => {
  if (!responseText) return {};

  const metrics = {
    sensibilidad: null,
    especificidad: null,
    precision: null,
    nnr: null,
    saturacion: null
  };

  console.log("Extrayendo métricas del texto de respuesta");

  // Extraer sensibilidad (búsqueda de patrones comunes)
  const sensibilidadPatterns = [
    /sensibilidad(?:\sestimada)?:?\s*(?:~|aprox\.?|aproximadamente)?\s*(\d+)[%\s]/i,
    /(\d+)%\s+(?:de\s+)?sensibilidad/i,
    /sensibilidad(?:[^\n:]*):?\s*(\d+)%/i,
    /sensibilidad\s+estimada:\s*(\d+)%/i
  ];
  
  for (const pattern of sensibilidadPatterns) {
    const match = responseText.match(pattern);
    if (match && match[1]) {
      metrics.sensibilidad = parseInt(match[1], 10);
      console.log(`Sensibilidad encontrada: ${metrics.sensibilidad}%`);
      break;
    }
  }

  // Extraer precisión
  const precisionPatterns = [
    /precisi[óo]n(?:\sestimada)?:?\s*(?:~|aprox\.?|aproximadamente)?\s*(\d+)[%\s]/i,
    /(\d+)%\s+(?:de\s+)?precisi[óo]n/i,
    /precisi[óo]n(?:[^\n:]*):?\s*(\d+)%/i,
    /precisi[óo]n\s+estimada:\s*(\d+)%/i
  ];
  
  for (const pattern of precisionPatterns) {
    const match = responseText.match(pattern);
    if (match && match[1]) {
      metrics.precision = parseInt(match[1], 10);
      console.log(`Precisión encontrada: ${metrics.precision}%`);
      break;
    }
  }

  // Extraer especificidad
  const especificidadPatterns = [
    /especificidad(?:\sestimada)?:?\s*(?:~|aprox\.?|aproximadamente)?\s*(\d+)[%\s]/i,
    /(\d+)%\s+(?:de\s+)?especificidad/i,
    /especificidad(?:[^\n:]*):?\s*(\d+)%/i,
    /especificidad\s+estimada:\s*(\d+)%/i
  ];
  
  for (const pattern of especificidadPatterns) {
    const match = responseText.match(pattern);
    if (match && match[1]) {
      metrics.especificidad = parseInt(match[1], 10);
      console.log(`Especificidad encontrada: ${metrics.especificidad}%`);
      break;
    }
  }
  
  // Búsqueda en formato de lista o líneas separadas
  if (!metrics.sensibilidad || !metrics.precision || !metrics.especificidad) {
    const lines = responseText.split('\n');
    for (const line of lines) {
      // Buscar líneas específicas con métricas
      if (!metrics.sensibilidad && line.toLowerCase().includes('sensibilidad')) {
        const match = line.match(/(\d+)%/);
        if (match && match[1]) {
          metrics.sensibilidad = parseInt(match[1], 10);
          console.log(`Sensibilidad encontrada en línea: ${metrics.sensibilidad}%`);
        }
      }
      
      if (!metrics.precision && (line.toLowerCase().includes('precisión') || line.toLowerCase().includes('precision'))) {
        const match = line.match(/(\d+)%/);
        if (match && match[1]) {
          metrics.precision = parseInt(match[1], 10);
          console.log(`Precisión encontrada en línea: ${metrics.precision}%`);
        }
      }
      
      if (!metrics.especificidad && line.toLowerCase().includes('especificidad')) {
        const match = line.match(/(\d+)%/);
        if (match && match[1]) {
          metrics.especificidad = parseInt(match[1], 10);
          console.log(`Especificidad encontrada en línea: ${metrics.especificidad}%`);
        }
      }
    }
  }

  // Si aún no tenemos especificidad, estimar basado en precisión (solo si tenemos precisión)
  if (!metrics.especificidad && metrics.precision) {
    metrics.especificidad = Math.min(95, Math.round(metrics.precision * 1.1));
    console.log(`Especificidad estimada: ${metrics.especificidad}%`);
  }

  // Extraer NNR (Número Necesario a Leer)
  const nnrPatterns = [
    /NNR(?:\sestimado)?:?\s*(?:~|aprox\.?|aproximadamente)?\s*(\d+(?:\.\d+)?)/i,
    /[nN][úu]mero\s+[nN]ecesario\s+(?:a|para)\s+[lL]eer:?\s*(\d+(?:\.\d+)?)/i,
    /NNR(?:[^\n:]*):?\s*(\d+(?:\.\d+)?)/i
  ];
  
  for (const pattern of nnrPatterns) {
    const match = responseText.match(pattern);
    if (match && match[1]) {
      metrics.nnr = parseFloat(match[1]);
      console.log(`NNR encontrado: ${metrics.nnr}`);
      break;
    }
  }
  
  // Si no tenemos NNR pero tenemos precisión, calcularlo
  if (!metrics.nnr && metrics.precision) {
    metrics.nnr = Math.round((100 / metrics.precision) * 10) / 10; // Redondear a 1 decimal
    console.log(`NNR calculado: ${metrics.nnr}`);
  }

  // Extraer saturación
  const saturacionPatterns = [
    /saturaci[óo]n(?:\sestimada)?:?\s*(?:~|aprox\.?|aproximadamente)?\s*(\d+)[%\s]/i,
    /saturaci[óo]n(?:[^\n:]*):?\s*(\d+)%/i,
    /saturaci[óo]n\s+estimada:\s*(\d+)%/i
  ];
  
  for (const pattern of saturacionPatterns) {
    const match = responseText.match(pattern);
    if (match && match[1]) {
      metrics.saturacion = parseInt(match[1], 10);
      console.log(`Saturación encontrada: ${metrics.saturacion}%`);
      break;
    }
  }
  
  // Si no encontramos saturación en los patrones, buscar en líneas
  if (!metrics.saturacion) {
    const lines = responseText.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes('saturación') || line.toLowerCase().includes('saturacion')) {
        const match = line.match(/(\d+)%/);
        if (match && match[1]) {
          metrics.saturacion = parseInt(match[1], 10);
          console.log(`Saturación encontrada en línea: ${metrics.saturacion}%`);
          break;
        }
      }
    }
  }
  
  // Estimar saturación si no se encontró
  if (!metrics.saturacion && metrics.sensibilidad) {
    metrics.saturacion = Math.min(99, Math.round(metrics.sensibilidad * 1.15));
    console.log(`Saturación estimada: ${metrics.saturacion}%`);
  }

  // Si no tenemos valores básicos, usar predeterminados indicando claramente que son estimaciones
  if (!metrics.sensibilidad) {
    metrics.sensibilidad = 70;
    console.log('Usando valor predeterminado para sensibilidad: 70%');
  }
  
  if (!metrics.precision) {
    metrics.precision = 75;
    console.log('Usando valor predeterminado para precisión: 75%');
  }
  
  if (!metrics.especificidad) {
    metrics.especificidad = 85;
    console.log('Usando valor predeterminado para especificidad: 85%');
  }
  
  if (!metrics.nnr) {
    metrics.nnr = 4;
    console.log('Usando valor predeterminado para NNR: 4');
  }
  
  if (!metrics.saturacion) {
    metrics.saturacion = 80;
    console.log('Usando valor predeterminado para saturación: 80%');
  }

  return metrics;
};

/**
 * Determina el color basado en el valor y umbrales
 * @param {number} value - Valor a evaluar
 * @param {number} lowThreshold - Umbral para considerarse bajo
 * @param {number} highThreshold - Umbral para considerarse alto
 * @returns {string} Nombre de clase CSS con el color
 */
function getColorForValue(value, lowThreshold, highThreshold) {
  if (value >= highThreshold) return 'success';
  if (value >= lowThreshold) return 'warning';
  return 'danger';
}

/**
 * Determina el color para el NNR (Número Necesario a Leer)
 * Para NNR, valores más bajos son mejores
 * @param {number} value - Valor de NNR
 * @returns {string} Nombre de clase CSS con el color
 */
function getColorForNNR(value) {
  if (value <= 3) return 'success';
  if (value <= 6) return 'warning';
  return 'danger';
}

/**
 * Genera el HTML para los badges de métricas
 * @param {Object} values - Valores de las métricas
 * @param {Object} colors - Colores asignados a cada métrica
 * @returns {string} HTML con los badges formateados
 */
function generateBadgesHTML(values, colors) {
  return `<div class="search-metrics">
    <div class="metrics-title">Métricas de rendimiento estimadas:</div>
    <div class="metrics-badges">
      <span class="metric-badge ${colors.sensibilidad}">
        <span class="metric-name">Sensibilidad</span>
        <span class="metric-value">${values.sensibilidad}%</span>
      </span>
      <span class="metric-badge ${colors.especificidad}">
        <span class="metric-name">Especificidad</span>
        <span class="metric-value">${values.especificidad}%</span>
      </span>
      <span class="metric-badge ${colors.precision}">
        <span class="metric-name">Precisión</span>
        <span class="metric-value">${values.precision}%</span>
      </span>
      <span class="metric-badge ${colors.nnr}">
        <span class="metric-name">NNR</span>
        <span class="metric-value">${values.nnr}</span>
      </span>
      <span class="metric-badge ${colors.saturacion}">
        <span class="metric-name">Saturación</span>
        <span class="metric-value">${values.saturacion}%</span>
      </span>
    </div>
  </div>`;
}

/**
 * Genera el CSS necesario para los badges de métricas
 * @returns {string} CSS para los badges de métricas
 */
export const getMetricsBadgeStyles = () => {
  return `
  .search-metrics {
    margin-top: 20px;
    padding: 15px;
    border-radius: 8px;
    background-color: #f8f9fa;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  
  .metrics-title {
    font-weight: 600;
    margin-bottom: 10px;
    color: #495057;
    font-size: 0.9rem;
  }
  
  .metrics-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .metric-badge {
    display: inline-flex;
    align-items: center;
    padding: 5px 10px;
    border-radius: 30px;
    font-size: 0.85rem;
    font-weight: 500;
    color: white;
    box-shadow: 0 1px 3px rgba(0,0,0,0.12);
  }
  
  .metric-badge.success {
    background-color: #2ecc71;
  }
  
  .metric-badge.warning {
    background-color: #f39c12;
  }
  
  .metric-badge.danger {
    background-color: #e74c3c;
  }
  
  .metric-name {
    margin-right: 5px;
  }
  
  .metric-value {
    font-weight: 700;
  }
  
  @media (max-width: 768px) {
    .metrics-badges {
      flex-direction: column;
      align-items: flex-start;
    }
  }`;
};

// Exportamos las funciones privadas para que sean accesibles
export { getColorForValue, getColorForNNR, generateBadgesHTML };