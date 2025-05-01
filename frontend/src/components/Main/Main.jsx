import React, { useState, useEffect, useRef } from "react";
import SearchBar from "../SearchBar";
import Card from "../Card/Card";
import DiagnosisPanel from "../DiagnosisPanel";
import Spinner from "../Spinner";
import aiService from "../../services/aiService";
import notificationService from "../../services/notificationService";
import searchHistoryService from "../../services/searchHistoryService";
import pubmedService from "../../services/pubmedService";
import "./Main.css";
import io from "socket.io-client";

// Función para logs detallados
const logInfo = (message, data) => {
  const timestamp = new Date().toISOString();
  console.log(`[INFO ${timestamp}] ${message}`);
  if (data) console.log(data);
};

const logError = (message, error) => {
  const timestamp = new Date().toISOString();
  console.error(`[ERROR ${timestamp}] ${message}`);
  if (error) {
    console.error('Mensaje de error:', error.message);
    console.error('Stack:', error.stack);
    if (error.response) {
      console.error('Datos de respuesta:', error.response.data);
      console.error('Status:', error.response.status);
    }
  }
};

// Nuevo componente BatchProgressBar
const BatchProgressBar = ({ progress }) => {
  if (!progress.processing) return null;
  
  return (
    <div className="batch-progress-container">
      <div className="batch-progress-bar">
        <div 
          className="batch-progress-fill" 
          style={{ width: `${(progress.current / progress.total) * 100}%` }}
        ></div>
      </div>
      <p className="batch-progress-text">
        Analizando artículos: {progress.current} de {progress.total}
      </p>
    </div>
  );
};

const Main = ({ onSearch, onToggleIA, iaEnabled }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchStrategy, setSearchStrategy] = useState("");
  const [error, setError] = useState(null);
  const [apiResponse, setApiResponse] = useState(null);
  const [batchProgress, setBatchProgress] = useState({ 
    processing: false, 
    total: 0, 
    current: 0 
  });
  const [socketStatus, setSocketStatus] = useState({
    connected: false,
    error: null,
    lastMessage: null
  });
  // Estados para la síntesis con IA
  const [showSynthesisModal, setShowSynthesisModal] = useState(false);
  const [synthesisContent, setSynthesisContent] = useState("");
  const [synthesisLoading, setSynthesisLoading] = useState(false);
  const [showReferences, setShowReferences] = useState(false);
  const [evidenceRating, setEvidenceRating] = useState(0);
  const [tooltipRef, setTooltipRef] = useState(null);
  const [tooltipData, setTooltipData] = useState(null);
  const tooltipDivRef = useRef(null);

  useEffect(() => {
    logInfo("Componente Main montado");
    // Cargar historial al iniciar
    const history = searchHistoryService.getHistory();
    logInfo(`Historial de búsquedas cargado: ${history.length} entradas`);
    
    return () => {
      logInfo("Componente Main desmontado");
    };
  }, []);

  useEffect(() => {
    let socket = null;
    
    try {
      // Obtener la URL base del backend desde variables de entorno o usar un valor predeterminado
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      console.log(`Intentando conectar socket a: ${backendUrl}`);
      
      // Añadir modo debug para ver mensajes detallados de Socket.IO
      window.localStorage.setItem('debug', 'socket.io-client:*');
      
      socket = io(backendUrl, {
        transports: ['polling', 'websocket'], // Intentar primero polling, luego websocket
        reconnectionAttempts: 5, // Número máximo de intentos de reconexión
        reconnectionDelay: 1000, // Retraso entre intentos (1 segundo)
        timeout: 10000, // Aumentar tiempo de espera para conexión (10 segundos)
        forceNew: true // Forzar nueva conexión
      });
      
      socket.on('connect', () => {
        console.log('Socket conectado con ID:', socket.id);
        setSocketStatus(prev => ({
          ...prev,
          connected: true,
          error: null
        }));
      });
      
      socket.on('welcome', (data) => {
        console.log('Mensaje de bienvenida recibido:', data);
        setSocketStatus(prev => ({
          ...prev,
          lastMessage: data.message
        }));
      });
      
      socket.on('batchProgress', (progress) => {
        console.log('Progreso de lote recibido:', progress);
        setBatchProgress(progress);
      });
      
      socket.on('connect_error', (error) => {
        console.error('Error de conexión de socket:', error);
        setSocketStatus(prev => ({
          ...prev,
          connected: false,
          error: `Error de conexión: ${error.message}`
        }));
      });
      
      socket.on('disconnect', (reason) => {
        console.log('Socket desconectado. Razón:', reason);
        setSocketStatus(prev => ({
          ...prev,
          connected: false
        }));
      });
      
      socket.on('error', (error) => {
        console.error('Error de socket:', error);
        setSocketStatus(prev => ({
          ...prev,
          error: `Error: ${error.message || 'Desconocido'}`
        }));
      });
    } catch (error) {
      console.error('No se pudo inicializar Socket.IO:', error);
      setSocketStatus({
        connected: false,
        error: `Error de inicialización: ${error.message}`,
        lastMessage: null
      });
    }
    
    // Función de limpieza
    return () => {
      if (socket) {
        console.log('Desconectando socket...');
        socket.disconnect();
      }
    };
  }, []);

  const handleInputChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    
    logInfo(`Iniciando búsqueda para: "${searchQuery}"`, {
      iaEnabled,
      timestamp: new Date().toISOString()
    });
    
    if (!searchQuery.trim()) {
      notificationService.showError("Error", "Por favor, introduce una pregunta clínica");
      logError("Búsqueda cancelada: Consulta vacía");
      return;
    }
    
    setLoading(true);
    setSearchResults(null);
    setArticles([]);
    setSearchStrategy("");
    setApiResponse(null);
    setError(null);
    
    // Definir los pasos del proceso con tiempos estimados
    const searchSteps = [
      {
        title: "Formulando pregunta clínica",
        description: "Analizando la estructura y elementos clave de su consulta",
        estimatedTime: 3
      },
      {
        title: "Generando estrategia de búsqueda",
        description: "Utilizando IA para optimizar términos y operadores booleanos",
        estimatedTime: 10
      },
      {
        title: "Buscando artículos relacionados",
        description: "Consultando base de datos PubMed y otros recursos médicos",
        estimatedTime: 45
      },
      {
        title: "Analizando resultados",
        description: "Evaluando relevancia y calidad de la evidencia encontrada",
        estimatedTime: 30
      }
    ];
    
    // Mostrar la notificación de proceso - ahora devuelve un ID
    let processAlertId = notificationService.showProcessSteps(searchSteps, 0);
    logInfo("Notificación de proceso iniciada", { steps: searchSteps, alertId: processAlertId });
    
    // Mostrar el spinner global durante la búsqueda
    document.getElementById('global-spinner-container').style.display = 'flex';
    const globalSpinnerText = document.querySelector('.global-spinner-text');
    if (globalSpinnerText) {
      globalSpinnerText.textContent = "Procesando su consulta científica...";
    }
    
    try {
      // PASO 1: Formulando pregunta clínica
      logInfo("PASO 1: Formulando pregunta clínica");
      await new Promise(resolve => setTimeout(resolve, 1000));
      processAlertId = notificationService.updateProcessStep(processAlertId, searchSteps, 1);
      logInfo("Paso 1 completado");
      
      // PASO 2: Si IA está habilitada, generamos estrategia de búsqueda con IA
      logInfo("PASO 2: Generando estrategia de búsqueda con IA", { iaEnabled });
      let searchStrategyText = "";
      let fullResponseText = "";
      
      if (iaEnabled) {
        try {
          // Intentamos usar el servicio real de IA
          logInfo("Solicitando estrategia a Claude", { query: searchQuery });
          const startTime = Date.now();
          const strategyResponse = await aiService.generateSearchStrategy(searchQuery);
          const endTime = Date.now();
          logInfo(`Estrategia generada en ${endTime - startTime}ms`);
          
          // Manejar tanto formato de objeto como string directa
          if (strategyResponse && typeof strategyResponse === 'object') {
            searchStrategyText = strategyResponse.strategy || "";
            fullResponseText = strategyResponse.fullResponse || "";
            logInfo("Estrategia recibida en formato objeto", {
              strategyLength: searchStrategyText.length,
              fullResponseLength: fullResponseText.length
            });
          } else {
            // Compatibilidad con formato anterior
            searchStrategyText = strategyResponse || "";
            fullResponseText = strategyResponse || "";
            logInfo("Estrategia recibida en formato string", {
              length: searchStrategyText.length
            });
          }
          
          logInfo("Contenido de la estrategia:", searchStrategyText);
          setSearchStrategy(fullResponseText); // Guardar la respuesta completa para mostrarla en la UI
        } catch (error) {
          logError("Error al generar estrategia de búsqueda", error);
          setError({
            title: "Error en IA",
            message: `No se pudo generar la estrategia de búsqueda: ${error.message}`,
          });
          notificationService.closeNotification(processAlertId);
          notificationService.showError("Error en IA", `No se pudo generar la estrategia de búsqueda: ${error.message}`);
          setLoading(false);
          return;
        }
      } else {
        logInfo("IA desactivada, no se genera estrategia de búsqueda");
      }
      
      // PASO 3: Buscando artículos en PubMed
      logInfo("PASO 3: Buscando artículos en PubMed");
      
      // Actualizar mensaje de progreso para este paso que toma más tiempo
      processAlertId = notificationService.updateProcessStep(
        processAlertId, 
        searchSteps, 
        2, 
        `<strong>Consultando bases de datos científicas...</strong><br>Este proceso puede demorar hasta 60 segundos mientras recuperamos los artículos más relevantes para tu consulta.<br><span class="time-estimate">Tiempo estimado: ${searchSteps[2].estimatedTime} segundos</span>`
      );
      
      // Actualizar el texto del spinner global
      if (globalSpinnerText) {
        globalSpinnerText.textContent = "Consultando PubMed para encontrar la mejor evidencia científica...";
        
        // Crear un intervalo para cambiar el mensaje cada 12 segundos
        const spinnerMessages = [
          "Buscando en base de datos de PubMed...",
          "Recuperando artículos científicos relevantes...",
          "Filtrando por nivel de evidencia científica...",
          "Esto puede tomar un momento, pero valdrá la pena...",
          "Estamos trabajando a toda velocidad para ti..."
        ];
        
        let messageIndex = 0;
        const messageInterval = setInterval(() => {
          messageIndex = (messageIndex + 1) % spinnerMessages.length;
          globalSpinnerText.textContent = spinnerMessages[messageIndex];
        }, 12000);
        
        // Guardar el ID del intervalo para limpiarlo más tarde
        window.searchSpinnerIntervalId = messageInterval;
      }
      
      // Usar directamente pubmedService para buscar en PubMed
      let pubmedResults = null;
      
      try {
        // Asegurarnos de que searchStrategyText sea una string antes de usar substring
        const strategyPreview = typeof searchStrategyText === 'string' && searchStrategyText.length > 0 
          ? searchStrategyText.substring(0, 100) + "..." 
          : "No disponible";
          
        logInfo("Iniciando búsqueda en PubMed", {
          query: searchQuery,
          strategy: strategyPreview,
          useAI: iaEnabled
        });
        
        const startApiTime = Date.now();
        pubmedResults = await pubmedService.search(searchQuery, searchStrategyText, iaEnabled);
        const endApiTime = Date.now();
        
        logInfo(`Respuesta de PubMed recibida en ${endApiTime - startApiTime}ms`);
        logInfo("Detalles de resultados:", {
          totalResults: pubmedResults?.results?.length || 0,
          strategy: pubmedResults?.searchStrategy ? "Generada" : "No disponible"
        });
        
        setApiResponse(pubmedResults);
        
        // Verificar si hay resultados reales de PubMed
        if (pubmedResults && pubmedResults.results && Array.isArray(pubmedResults.results)) {
          const realArticlesCount = pubmedResults.results.length;
          logInfo(`Artículos recibidos de PubMed: ${realArticlesCount}`);
          
          if (realArticlesCount > 0) {
            setSearchResults({
              query: searchQuery,
              iaEnabled: iaEnabled,
              count: realArticlesCount
            });
            
            // PASO 4: Si hay resultados reales y la IA está habilitada, los analizamos
            const realArticles = pubmedResults.results;
            
            if (iaEnabled) {
              processAlertId = notificationService.updateProcessStep(
                processAlertId, 
                searchSteps, 
                3, 
                `<strong>Analizando artículos científicos...</strong><br>Estamos evaluando la metodología y conclusiones de cada estudio para ofrecerte el mejor análisis posible.<br><span class="time-estimate">Tiempo estimado: ${searchSteps[3].estimatedTime} segundos</span>`
              );
              
              // Actualizar el texto del spinner global
              if (globalSpinnerText) {
                globalSpinnerText.textContent = "Analizando la evidencia científica encontrada...";
              }
              
              logInfo("PASO 4: Analizando resultados reales con IA");
              
              try {
                logInfo(`Iniciando análisis de ${realArticlesCount} artículos reales`);
                const startAnalysisTime = Date.now();
                
                // Comprobamos si los artículos ya tienen análisis del backend
                const needAnalysis = !realArticles.some(article => article.secondaryAnalysis);
                
                let articlesWithAnalysis = realArticles;
                
                if (needAnalysis) {
                  logInfo("Los artículos no tienen análisis del backend, realizando análisis con Claude");
                  articlesWithAnalysis = await aiService.analyzeArticleBatch(realArticles, searchQuery);
                } else {
                  logInfo("Los artículos ya incluyen análisis del backend, no es necesario analizarlos de nuevo");
                }
                
                const endAnalysisTime = Date.now();
                logInfo(`Análisis completado en ${endAnalysisTime - startAnalysisTime}ms`);
                
                // Mostrar muestra de análisis
                if (articlesWithAnalysis.length > 0 && articlesWithAnalysis[0].secondaryAnalysis) {
                  logInfo("Muestra de análisis:", {
                    pmid: articlesWithAnalysis[0].pmid,
                    titulo: articlesWithAnalysis[0].title.substring(0, 50) + "...",
                    analisis: articlesWithAnalysis[0].secondaryAnalysis.substring(0, 100) + "..."
                  });
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                logInfo(`Mostrando ${articlesWithAnalysis.length} artículos analizados`);
                setArticles(articlesWithAnalysis);
              } catch (error) {
                logError("Error al analizar artículos reales", error);
                notificationService.showError(
                  "Error en análisis", 
                  "No se pudo completar el análisis secundario de los artículos."
                );
                // Mostrar los artículos sin análisis
                setArticles(realArticles);
              }
            } else {
              // Si IA no está habilitada, mostramos los artículos tal cual
              logInfo("IA desactivada, mostrando artículos sin análisis secundario");
              setArticles(realArticles);
            }
            
            // Guardar la búsqueda en el historial
            searchHistoryService.addSearch({
              query: searchQuery,
              useAI: iaEnabled,
              resultsCount: realArticles.length,
              strategy: fullResponseText || searchStrategyText // Usar respuesta completa si existe
            });
            logInfo("Búsqueda guardada en historial");
            
            // Cerrar notificación de proceso de manera definitiva
            notificationService.closeNotification(processAlertId);
            
            setLoading(false);
            return;
          }
        }
        
        // Si llegamos aquí es porque no hay resultados reales
        logInfo("No se encontraron artículos en PubMed o formato de respuesta inválido");
        
        // Mostrar notificación de no resultados
        notificationService.closeNotification(processAlertId);
        notificationService.showInfo(
          "Sin resultados", 
          "No se encontraron artículos que coincidan con su consulta. Intente con términos más generales."
        );
        
        setLoading(false);
        return;
      } catch (apiError) {
        logError("Error en la búsqueda en PubMed", apiError);
        notificationService.closeNotification(processAlertId);
        notificationService.showError(
          "Error en la búsqueda", 
          `No se pudieron obtener resultados: ${apiError.message}`
        );
        setLoading(false);
        return;
      }
      
    } catch (error) {
      logError("Error general en el proceso de búsqueda", error);
      notificationService.closeNotification(processAlertId);
      notificationService.showError(
        "Error en la búsqueda", 
        "No se pudieron obtener resultados para su consulta. Por favor, inténtelo de nuevo."
      );
    } finally {
      setLoading(false);
      // Ocultar el spinner global cuando termine el proceso
      document.getElementById('global-spinner-container').style.display = 'none';
      
      // Limpiar el intervalo por si acaso
      if (window.searchSpinnerIntervalId) {
        clearInterval(window.searchSpinnerIntervalId);
        window.searchSpinnerIntervalId = null;
      }
    }
  };

  // Función para generar la síntesis de los artículos
  const generateSynthesis = async () => {
    if (!articles || articles.length === 0) {
      notificationService.showError("Error", "No hay artículos para sintetizar");
      return;
    }

    logInfo("Iniciando síntesis de evidencia científica", { 
      articlesCount: articles.length,
      clinicalQuestion: searchQuery
    });
    
    // Calcular tiempos estimados basados en la cantidad de artículos
    const articleCount = articles.length;
    // Tiempos estimados en segundos para cada fase (basados en logs analizados)
    const timeEstimates = {
      preparacion: 2 + (articleCount * 0.5),  // Tiempo base + tiempo por artículo
      analisis: 5 + (articleCount * 3),       // Análisis inicial de artículos
      sintesis: 15 + (articleCount * 2),      // Sintetizar los hallazgos
      conclusion: 20 + (articleCount * 1.5)   // Generar conclusiones
    };
    
    // Tiempo total estimado en segundos
    const totalEstimatedTime = Object.values(timeEstimates).reduce((sum, time) => sum + time, 0);
    // Convertir a formato minutos:segundos
    const estimatedMinutes = Math.floor(totalEstimatedTime / 60);
    const estimatedSeconds = Math.floor(totalEstimatedTime % 60);
    const timeFormatted = `${estimatedMinutes}:${estimatedSeconds.toString().padStart(2, '0')}`;
    
    logInfo("Tiempo estimado para síntesis", { 
      totalSeconds: totalEstimatedTime,
      formattedTime: timeFormatted,
      articleCount,
      timeEstimates
    });
    
    setSynthesisLoading(true);
    setShowReferences(false);

    // Definir los pasos del proceso de síntesis con tiempos estimados
    const synthesisSteps = [
      {
        title: "Analizando artículos científicos",
        description: "Extrayendo información relevante de los estudios seleccionados",
        estimatedTime: timeEstimates.preparacion
      },
      {
        title: "Evaluando calidad metodológica",
        description: "Valorando el nivel de evidencia y posibles sesgos de cada artículo",
        estimatedTime: timeEstimates.analisis
      },
      {
        title: "Sintetizando hallazgos",
        description: "Organizando la evidencia según temas y relevancia clínica",
        estimatedTime: timeEstimates.sintesis
      },
      {
        title: "Generando conclusiones",
        description: "Integrando toda la evidencia para responder a tu pregunta clínica",
        estimatedTime: timeEstimates.conclusion
      }
    ];
    
    // Mostrar notificación de proceso de síntesis con pasos y tiempo total estimado - ahora devuelve un ID
    let synthesisAlertId = notificationService.showProcessSteps(
      synthesisSteps, 
      0, 
      `<strong>Preparando análisis de evidencia científica</strong><br>Estamos organizando los datos de los ${articleCount} artículos para un análisis exhaustivo.<br><span class="time-total-estimate">Tiempo total estimado: ${timeFormatted} minutos</span>`
    );

    // --- NUEVO: Guardar los IDs de los timeouts para poder cancelarlos ---
    let timeoutStep1 = null;
    let timeoutStep2 = null;
    let timeoutStep3 = null;
    
    try {
      // Avanzar al primer paso después de 1 segundo para simular progreso
      timeoutStep1 = setTimeout(() => {
        synthesisAlertId = notificationService.updateProcessStep(
          synthesisAlertId, 
          synthesisSteps, 
          1,
          `<strong>Evaluando calidad metodológica</strong><br>Analizando la evidencia científica de los ${articleCount} artículos.<br><span class="time-estimate">Tiempo estimado: ${Math.ceil(timeEstimates.analisis)} segundos</span>`
        );
      }, 1000);

      // Preparar datos para la síntesis
      const articlesData = articles.map(article => ({
        title: article.title,
        authors: typeof article.authors === 'string' ? article.authors : (Array.isArray(article.authors) ? article.authors.map(a => a.name || a).join(", ") : ""),
        abstract: article.abstract,
        pmid: article.pmid,
        publicationDate: article.publicationDate,
        analysis: article.secondaryAnalysis
      }));

      logInfo("Datos de artículos preparados para síntesis", { count: articlesData.length });

      // Avanzar al segundo paso después de 8 segundos
      timeoutStep2 = setTimeout(() => {
        synthesisAlertId = notificationService.updateProcessStep(
          synthesisAlertId, 
          synthesisSteps, 
          2,
          `<strong>Sintetizando hallazgos científicos</strong><br>Organizando la información por temas y relevancia clínica.<br><span class="time-estimate">Tiempo estimado: ${Math.ceil(timeEstimates.sintesis)} segundos</span>`
        );
      }, 8000);

      // Calcular puntuación de calidad de evidencia (1-5 estrellas)
      let evidenceScore = calculateEvidenceRating(articles);
      setEvidenceRating(evidenceScore);
      
      // Avanzar al tercer paso después de otros 16 segundos
      timeoutStep3 = setTimeout(() => {
        synthesisAlertId = notificationService.updateProcessStep(
          synthesisAlertId, 
          synthesisSteps, 
          3,
          `<strong>Generando conclusiones</strong><br>Este es el paso final que integra todos los hallazgos.<br><span class="time-estimate">Tiempo estimado: ${Math.ceil(timeEstimates.conclusion)} segundos</span>`
        );
      }, 16000);
      
      // Iniciar tiempo para medir duración real
      const startTime = Date.now();
      
      // Llamar al servicio para generar la síntesis
      const result = await aiService.generateSynthesis(searchQuery, articlesData);
      
      // Calcular tiempo real que tomó
      const endTime = Date.now();
      const actualTimeSeconds = Math.round((endTime - startTime) / 1000);
      
      logInfo("Síntesis generada exitosamente", {
        estimatedTime: totalEstimatedTime,
        actualTime: actualTimeSeconds,
        difference: actualTimeSeconds - totalEstimatedTime
      });
      
      // Procesar contenido para agregar interactividad a las citas
      const processedContent = processCitationReferences(result, articles);
      
      // Guardar el resultado
      setSynthesisContent(processedContent);
      
      // --- NUEVO: Cancelar los timeouts antes de cerrar la alerta y mostrar el modal ---
      clearTimeout(timeoutStep1);
      clearTimeout(timeoutStep2);
      clearTimeout(timeoutStep3);
      
      // Cerrar alerta de proceso de manera definitiva y esperar un poco para asegurar que se cierre por completo
      notificationService.closeNotification(synthesisAlertId);
      
      // Pequeña pausa para asegurar que SweetAlert2 se cierre completamente antes de mostrar el modal
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mostrar el modal DESPUÉS de que la síntesis se ha generado correctamente
      setShowSynthesisModal(true);

    } catch (error) {
      logError("Error al generar síntesis", error);
      // --- NUEVO: Cancelar los timeouts también en caso de error ---
      clearTimeout(timeoutStep1);
      clearTimeout(timeoutStep2);
      clearTimeout(timeoutStep3);
      // Cerrar alerta de proceso y mostrar error
      notificationService.closeNotification(synthesisAlertId);
      notificationService.showError(
        "Error en síntesis", 
        `No se pudo generar la síntesis: ${error.message}`
      );
      // Cerrar el modal de síntesis en caso de error
      setShowSynthesisModal(false);
    } finally {
      setSynthesisLoading(false);
    }
  };

  // Procesa las referencias de las citas para hacerlas interactivas
  const processCitationReferences = (content, articlesData) => {
    if (!content) return '';
    
    // Patrón para encontrar citas en formato (Autor et al., año)
    const citationPattern = /\(([^)]+?et al\.,\s*\d{4})\)/g;
    
    // Reemplazar las citas con elementos interactivos
    return content.replace(citationPattern, (match, citation) => {
      return `<span class="citation-ref" data-citation="${citation}" onclick="document.dispatchEvent(new CustomEvent('showCitationTooltip', {detail: {citation: '${citation}'}}));">${match}</span>`;
    });
  };

  // Calcula la calificación de calidad de evidencia basada en los tipos de estudio
  const calculateEvidenceRating = (articles) => {
    // Valor predeterminado si no se pueden evaluar los artículos
    if (!articles || articles.length === 0) return 3;
    
    // Extraer calificación directamente de los badges de calidad (★★★☆☆)
    let totalStars = 0;
    let countedArticles = 0;
    
    // Primero intentamos extraer las calificaciones de estrellas directamente de los badges
    articles.forEach(article => {
      if (article.secondaryAnalysis) {
        // Buscar el badge de calidad con estrellas
        const qualityBadgeMatch = article.secondaryAnalysis.match(/<span class="badge quality">([★☆]+)<\/span>/);
        
        if (qualityBadgeMatch && qualityBadgeMatch[1]) {
          // Contar el número de estrellas completas (★)
          const stars = qualityBadgeMatch[1].split('').filter(char => char === '★').length;
          if (stars > 0) {
            totalStars += stars;
            countedArticles++;
            console.log(`Artículo con ${stars} estrellas detectado`);
          }
        }
      }
    });
    
    // Si encontramos estrellas, usar ese promedio
    if (countedArticles > 0) {
      const avgStars = totalStars / countedArticles;
      console.log(`Calificación media de estrellas: ${avgStars.toFixed(1)} (${totalStars} estrellas en ${countedArticles} artículos)`);
      return Math.min(5, Math.max(1, Math.round(avgStars)));
    }
    
    // Método alternativo basado en el tipo de estudio si no se encontraron badges
    // Ponderación por tipo de estudio (más alto = mejor evidencia)
    const weights = {
      'meta-análisis': 5,
      'metaanálisis': 5,
      'revisión sistemática': 4.5,
      'ensayo clínico aleatorizado': 4,
      'eca': 4,
      'cohorte': 3.5,
      'casos y controles': 3,
      'serie de casos': 2.5,
      'reporte de caso': 2,
      'opinión de expertos': 1.5
    };
    
    let totalWeight = 0;
    countedArticles = 0;
    
    // Analizar artículos y extraer tipo de estudio
    articles.forEach(article => {
      if (article.secondaryAnalysis) {
        // Buscar menciones de tipos de estudio en el análisis
        const analysis = article.secondaryAnalysis.toLowerCase();
        
        for (const [studyType, weight] of Object.entries(weights)) {
          if (analysis.includes(studyType)) {
            totalWeight += weight;
            countedArticles++;
            console.log(`Artículo con tipo de estudio ${studyType} detectado (peso ${weight})`);
            break; // Contar solo el tipo de estudio de mayor nivel por artículo
          }
        }
      }
    });
    
    // Si no se pudo determinar para ningún artículo, usar valor medio
    if (countedArticles === 0) {
      console.log('No se pudo determinar la calidad de ningún artículo, usando valor predeterminado (3)');
      return 3;
    }
    
    // Calcular promedio y escalar a 1-5
    const avgWeight = totalWeight / countedArticles;
    console.log(`Calificación media por tipo de estudio: ${avgWeight.toFixed(1)} (${countedArticles} artículos)`);
    return Math.min(5, Math.max(1, Math.round(avgWeight)));
  };

  // Función para manejar la visibilidad del tooltip de citas
  useEffect(() => {
    const handleCitationTooltip = (event) => {
      const citation = event.detail.citation;
      
      // Buscar el artículo correspondiente a esta cita
      const matchedArticle = findArticleByCitation(citation, articles);
      
      if (matchedArticle) {
        setTooltipData({
          title: matchedArticle.title,
          authors: typeof matchedArticle.authors === 'string' ? matchedArticle.authors : 
                  (Array.isArray(matchedArticle.authors) ? matchedArticle.authors.map(a => a.name || a).join(", ") : ""),
          pmid: matchedArticle.pmid,
          year: matchedArticle.publicationDate ? new Date(matchedArticle.publicationDate).getFullYear() : ''
        });
        
        // Obtener el elemento que se clickeó
        const elements = document.querySelectorAll(`[data-citation="${citation}"]`);
        if (elements.length > 0) {
          setTooltipRef(elements[0]);
        }
      }
    };
    
    // Agregar event listener para los eventos de citas
    document.addEventListener('showCitationTooltip', handleCitationTooltip);
    
    // Limpiar el event listener
    return () => {
      document.removeEventListener('showCitationTooltip', handleCitationTooltip);
    };
  }, [articles]);
  
  // Posiciona el tooltip cerca del elemento referencia
  useEffect(() => {
    if (tooltipRef && tooltipDivRef.current) {
      const rect = tooltipRef.getBoundingClientRect();
      const tooltipElement = tooltipDivRef.current;
      
      // Posicionar el tooltip encima o debajo del elemento referencia
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      
      if (spaceBelow > 150 || spaceBelow > spaceAbove) {
        // Posicionar debajo
        tooltipElement.style.top = `${rect.bottom + 5}px`;
      } else {
        // Posicionar encima
        tooltipElement.style.bottom = `${window.innerHeight - rect.top + 5}px`;
        tooltipElement.style.top = 'auto';
      }
      
      // Centrar horizontalmente
      tooltipElement.style.left = `${rect.left + (rect.width / 2) - 150}px`;
      tooltipElement.classList.add('visible');
      
      // Ocultar el tooltip después de un tiempo
      const timer = setTimeout(() => {
        tooltipElement.classList.remove('visible');
        setTimeout(() => {
          setTooltipRef(null);
          setTooltipData(null);
        }, 200);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [tooltipRef]);
  
  // Busca un artículo por su cita
  const findArticleByCitation = (citation, articlesList) => {
    if (!citation || !articlesList) return null;
    
    // Extraer el apellido del autor principal y el año
    const match = citation.match(/([^\s,]+)(?:\s+et\s+al\.)?,\s*(\d{4})/);
    if (!match) return null;
    
    const authorLastName = match[1].toLowerCase();
    const year = match[2];
    
    // Buscar el artículo que coincida con el autor y año
    return articlesList.find(article => {
      // Verificar año de publicación
      const articleYear = article.publicationDate ? new Date(article.publicationDate).getFullYear().toString() : '';
      if (articleYear !== year) return false;
      
      // Verificar autor
      const authors = typeof article.authors === 'string' ? article.authors : 
                     (Array.isArray(article.authors) ? article.authors.map(a => a.name || a).join(", ") : "");
      
      return authors.toLowerCase().includes(authorLastName);
    });
  };

  // Función para exportar la síntesis como PDF
  const exportSynthesisAsPDF = () => {
    // Este es un placeholder. En una implementación real, 
    // aquí se generaría un PDF con la síntesis y se descargaría
    alert("Exportación a PDF no implementada en esta versión");
  };
  
  // Función para guardar la síntesis (implementación futura)
  const saveSynthesis = () => {
    alert("Guardar síntesis: Funcionalidad que se implementará en versiones futuras");
  };

  // Función para cerrar el modal de síntesis
  const closeSynthesisModal = () => {
    setShowSynthesisModal(false);
  };

  const handleToggle = (checked) => {
    onToggleIA(checked);
    logInfo(`Asistencia IA ${checked ? 'activada' : 'desactivada'}`);
  };

  useEffect(() => {
    // Asignar color automáticamente a los badges de heterogeneidad
    if (showSynthesisModal && synthesisContent) {
      setTimeout(() => {
        const stats = document.querySelectorAll('.heterogeneity-stat .stat-value');
        stats.forEach((el) => {
          const text = el.textContent.trim();
          // Buscar porcentaje (I²)
          const percentMatch = text.match(/(\d{1,3})%/);
          if (percentMatch) {
            const value = parseInt(percentMatch[1], 10);
            el.classList.remove('badge-bueno', 'badge-regular', 'badge-malo');
            if (value < 25) {
              el.classList.add('badge-bueno');
            } else if (value < 50) {
              el.classList.add('badge-regular');
            } else {
              el.classList.add('badge-malo');
            }
          }
          // Puedes agregar más lógica para otros tipos de stats si lo deseas
        });
      }, 100);
    }
  }, [showSynthesisModal, synthesisContent]);

  return (
    <main className="main-container">
      {/* Spinner global para mostrar durante el proceso */}
      <div id="global-spinner-container" className="global-spinner-container">
        <Spinner />
        <p className="global-spinner-text spinner-text-animated">Procesando su consulta...</p>
      </div>
      {/* Modal de síntesis que se muestra cuando showSynthesisModal es true */}
      {showSynthesisModal && (
        <div className="synthesis-modal-overlay">
          <div className="synthesis-modal">
            <div className="synthesis-modal-header">
              <div className="synthesis-header-content">
                <h2>Síntesis de Evidencia Científica</h2>
                <div className="synthesis-rating">
                  <div className="star-rating">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star}>{star <= evidenceRating ? "★" : "☆"}</span>
                    ))}
                  </div>
                  <span className="synthesis-rating-value">
                    {evidenceRating}/5
                  </span>
                </div>
              </div>
              <button className="close-modal-btn" onClick={closeSynthesisModal}>×</button>
            </div>
            <div className="synthesis-modal-body">
              {synthesisLoading ? (
                null // No mostrar nada adicional durante la carga, ya que hay una alerta externa con los pasos
              ) : (
                <div className="synthesis-content">
                  <h3>
                    <span style={{ fontWeight: "600", color: "#6c47d5" }}>Pregunta clínica:</span> 
                    {searchQuery}
                  </h3>
                  
                  {/* Descargo de responsabilidad médica */}
                  <div className="synthesis-disclaimer">
                    <div className="disclaimer-icon">⚠️</div>
                    <div className="disclaimer-content">
                      <h4>Aviso importante</h4>
                      <p>La IA puede cometer errores. Esta síntesis no reemplaza una consulta médica ni el criterio médico profesional. Esta herramienta fue creada para ser un apoyo clínico al quehacer de los profesionales de la salud.</p>
                    </div>
                  </div>
                  
                  <div className="synthesis-meta-banner">
                    <div className="meta-icon">📊</div>
                    <div className="meta-content">
                      <div className="meta-title">Análisis Meta-analítico</div>
                      <div className="meta-description">Esta síntesis incluye evaluación de heterogeneidad, forest plots y otras métricas cuantitativas.</div>
                    </div>
                  </div>
                  
                  <div className="synthesis-text">
                    {synthesisContent ? (
                      <div dangerouslySetInnerHTML={{ __html: synthesisContent }} />
                    ) : (
                      <p>No hay contenido disponible</p>
                    )}
                  </div>
                  
                  {/* Sección de visualizaciones */}
                  <div className="forest-plot-container">
                    {/* El forest plot se generará dinámicamente con los datos de la síntesis */}
                  </div>
                  
                  {/* Sección de referencias (oculta por defecto) */}
                  <div className={`references-section ${showReferences ? 'visible' : ''}`}>
                    <h4>Referencias</h4>
                    <ol className="references-list">
                      {articles.map((article) => (
                        <li key={article.pmid}>
                          {article.authors &&
                            `${Array.isArray(article.authors)
                              ? article.authors.map(a => (typeof a === 'string' ? a : (a.name || a.lastName || a.firstName || '')).trim()).filter(Boolean).join(', ')
                              : (typeof article.authors === 'object' && article.authors !== null
                                  ? (article.authors.name || article.authors.lastName || article.authors.firstName || '').trim()
                                  : article.authors)
                            }. `}
                          <strong>{article.title}</strong>
                          {article.source && ` ${article.source}.`}
                          {article.publicationDate && ` ${article.publicationDate}.`}
                          {article.pmid && ` PMID: ${article.pmid}`}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
            </div>
            
            {/* Pie del modal con botones de acción */}
            {!synthesisLoading && (
              <div className="synthesis-footer">
                <div className="synthesis-actions">
                  <button 
                    className="synthesis-btn synthesis-btn-primary"
                    onClick={exportSynthesisAsPDF}
                  >
                    <span className="synthesis-btn-icon">↓</span>
                    Exportar PDF
                  </button>
                  <button 
                    className="synthesis-btn synthesis-btn-secondary"
                    onClick={saveSynthesis}
                  >
                    <span className="synthesis-btn-icon">💾</span>
                    Guardar
                  </button>
                </div>
                <div 
                  className="references-toggle"
                  onClick={() => setShowReferences(!showReferences)}
                >
                  <span className="references-toggle-icon">
                    {showReferences ? '▲' : '▼'}
                  </span>
                  {showReferences ? 'Ocultar referencias' : 'Mostrar referencias'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Tooltip para las referencias de citas */}
      {tooltipRef && tooltipData && (
        <div className="tooltip" ref={tooltipDivRef}>
          <span className="tooltip-title">{tooltipData.title}</span>
          <span className="tooltip-authors">{tooltipData.authors}</span>
          {tooltipData.pmid && (
            <a 
              className="tooltip-link" 
              href={`https://pubmed.ncbi.nlm.nih.gov/${tooltipData.pmid}/`} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              Ver artículo en PubMed
            </a>
          )}
        </div>
      )}
      
      <div className="search-section">
        <h2 className="search-title">Evident-IA: Consulta Médica Inteligente</h2>
        <div className="search-description">
          <p>Obtenga respuestas rápidas y precisas a sus consultas clínicas</p>
        </div>
        
        <div className="search-card">
          <label htmlFor="search-input" className="search-label">
            Introduzca su pregunta clínica aquí
          </label>
          
          <SearchBar 
            value={searchQuery}
            onChange={handleInputChange}
            onSubmit={handleSearch}
          />
        </div>

        {/* Reemplazamos el panel de debug anterior con DiagnosisPanel */}
        <DiagnosisPanel
          query={searchQuery}
          iaEnabled={iaEnabled}
          loading={loading}
          articles={articles}
          apiResponse={apiResponse}
          error={error}
          searchStrategy={apiResponse?.searchStrategy || ''}
          socketStatus={socketStatus}
          onTestPubmed={() => {
            if (pubmedService) {
              console.log("Prueba de PubMed:", pubmedService);
              pubmedService.search("diabetes treatment", "", true, 3)
                .then(data => console.log("Test PubMed OK:", data))
                .catch(err => console.error("Test PubMed ERROR:", err));
            } else {
              console.error("Servicio de PubMed no disponible");
            }
          }}
        />

        {searchResults && (
          <div className="results-section">
            <div className="results-header">
              <div className="results-info">
                <h3>Resultados para: {searchResults.query}</h3>
                <p>Modo de búsqueda: {searchResults.iaEnabled ? "Con IA" : "Tradicional"}</p>
                <p>Se encontraron <strong>{searchResults.count}</strong> artículos relevantes</p>
                
                {/* Botón de síntesis con IA integrado en la card */}
                {articles.length > 0 && iaEnabled && (
                  <div className="synthesis-button-container">
                    <button 
                      className={`synthesis-button ${synthesisLoading ? 'synthesis-button-loading' : ''}`}
                      onClick={generateSynthesis}
                      disabled={synthesisLoading}
                      title="Generar síntesis de evidencia científica"
                    >
                      <span className="synthesis-icon">
                        {synthesisLoading ? '✨' : '🔬'}
                      </span>
                      <span className="synthesis-text">
                        {synthesisLoading ? 'Generando meta-análisis...' : 'Sintetizar evidencia científica'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {searchStrategy && (
              <div className="search-strategy">
                <h4>Estrategia de búsqueda generada:</h4>
                <div 
                  className="strategy-content" 
                  dangerouslySetInnerHTML={{ __html: searchStrategy }}
                />
              </div>
            )}
            
            {/* Mostrar spinner durante la carga de artículos */}
            {loading ? (
              <div className="spinner-container">
                <Spinner />
                <p className="spinner-text spinner-text-animated">
                  Procesando su consulta científica...
                  <br />
                  <span className="spinner-text-small">
                    Este proceso puede tardar hasta 2 minutos dependiendo de la complejidad de la búsqueda
                  </span>
                </p>
              </div>
            ) : (
              <div className="articles-grid">
                {articles.map((article) => (
                  <Card key={article.pmid || Math.random().toString(36)} article={article} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reemplazamos el código de barra de progreso con el nuevo componente */}
        <BatchProgressBar progress={batchProgress} />
      </div>
    </main>
  );
};

export default Main; 