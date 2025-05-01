import Swal from 'sweetalert2/dist/sweetalert2.js';
import 'sweetalert2/dist/sweetalert2.css';

/**
 * Servicio para mostrar notificaciones y alertas con SweetAlert2
 */
class NotificationService {
  constructor() {
    // Almacenar referencia global a cualquier alerta activa
    this.activeAlerts = {};
    // Flag para rastrear si estamos en un proceso de cierre explícito
    this.isExplicitlyClosing = false;
    // ID único para las alertas
    this.alertCounter = 0;
  }

  /**
   * Genera un ID único para cada alerta
   * @returns {string} - ID único
   */
  _generateAlertId() {
    this.alertCounter++;
    return `alert-${Date.now()}-${this.alertCounter}`;
  }

  /**
   * Limpia todos los intervalos y cierra todas las alertas de manera forzada
   * @private
   */
  _forceCloseAllAlerts() {
    // Establecer el flag para prevenir reaparición de alertas
    this.isExplicitlyClosing = true;

    // Limpiar todos los intervalos asociados a las alertas
    Object.values(this.activeAlerts).forEach(alertData => {
      if (alertData && alertData.intervalId) {
        clearInterval(alertData.intervalId);
      }
    });

    // Limpiar cualquier intervalo directamente en los popups
    const popups = document.querySelectorAll('.swal2-popup');
    popups.forEach(popup => {
      const intervalId = popup.getAttribute('data-interval-id');
      if (intervalId) {
        clearInterval(parseInt(intervalId, 10));
      }
    });
    
    // Cerrar todas las alertas de SweetAlert2
    Swal.close();
    
    // Vaciar el registro de alertas activas
    this.activeAlerts = {};
    
    // Después de un tiempo, restaurar el flag
    setTimeout(() => {
      this.isExplicitlyClosing = false;
    }, 500);
  }

  /**
   * Muestra una notificación de proceso en curso
   * @param {string} title - Título de la notificación
   * @param {string} message - Mensaje de la notificación
   * @returns {object} - Objeto de SweetAlert2 para controlar la alerta
   */
  showProcessNotification(title, message) {
    // Si estamos en proceso de cierre explícito, no mostrar una nueva alerta
    if (this.isExplicitlyClosing) return null;
    
    const alertId = this._generateAlertId();
    
    const alert = Swal.fire({
      title: title,
      html: message,
      icon: 'info',
      allowOutsideClick: false,
      allowEscapeKey: false,
      allowEnterKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
        // Asignar el ID al popup
        const popup = Swal.getPopup();
        if (popup) popup.setAttribute('data-alert-id', alertId);
      }
    });
    
    // Registrar la alerta
    this.activeAlerts[alertId] = { alert, intervalId: null };
    
    return alertId;
  }

  /**
   * Actualiza una notificación existente
   * @param {string} alertId - ID de la alerta de SweetAlert2
   * @param {string} title - Nuevo título
   * @param {string} message - Nuevo mensaje
   * @param {string} icon - Nuevo icono (info, success, warning, error)
   */
  updateNotification(alertId, title, message, icon = 'info') {
    // Si estamos en proceso de cierre explícito, no actualizar
    if (this.isExplicitlyClosing) return;
    
    if (alertId && this.activeAlerts[alertId]) {
      Swal.update({
        title: title,
        html: message,
        icon: icon
      });
    }
  }

  /**
   * Cierra una notificación existente
   * @param {string} alertId - ID de la alerta de SweetAlert2
   */
  closeNotification(alertId) {
    // Establecer flag para prevenir reaparición
    this.isExplicitlyClosing = true;
    
    // Limpiar todos los intervalos y cerrar alertas de manera forzada
    this._forceCloseAllAlerts();
    
    // Después de un tiempo, restaurar el flag
    setTimeout(() => {
      this.isExplicitlyClosing = false;
    }, 500);
  }

  /**
   * Muestra una notificación de éxito
   * @param {string} title - Título de la notificación
   * @param {string} message - Mensaje de la notificación
   */
  showSuccess(title, message) {
    // Si estamos en proceso de cierre explícito, no mostrar una nueva alerta
    if (this.isExplicitlyClosing) return null;
    
    const alertId = this._generateAlertId();
    
    const alert = Swal.fire({
      title: title,
      html: message,
      icon: 'success',
      timer: 2000,
      timerProgressBar: true,
      showConfirmButton: false,
      didOpen: (popup) => {
        // Asignar el ID al popup
        if (popup) popup.setAttribute('data-alert-id', alertId);
      }
    });
    
    // Registrar la alerta
    this.activeAlerts[alertId] = { alert, intervalId: null };
    
    return alertId;
  }

  /**
   * Muestra una notificación de error
   * @param {string} title - Título de la notificación
   * @param {string} message - Mensaje de la notificación
   */
  showError(title, message) {
    // Si estamos en proceso de cierre explícito, no mostrar una nueva alerta
    if (this.isExplicitlyClosing) return null;
    
    const alertId = this._generateAlertId();
    
    const alert = Swal.fire({
      title: title,
      html: message,
      icon: 'error',
      confirmButtonText: 'Entendido',
      didOpen: (popup) => {
        // Asignar el ID al popup
        if (popup) popup.setAttribute('data-alert-id', alertId);
      }
    });
    
    // Registrar la alerta
    this.activeAlerts[alertId] = { alert, intervalId: null };
    
    return alertId;
  }

  /**
   * Muestra una notificación de flujo de proceso
   * Esta notificación muestra cada paso del proceso con un indicador de progreso
   * @param {Array} steps - Arreglo de pasos a mostrar
   * @param {number} currentStep - Paso actual (índice del arreglo steps)
   * @param {string} customMessage - Mensaje adicional para mostrar (opcional)
   */
  showProcessSteps(steps, currentStep = 0, customMessage = '') {
    // Si estamos en proceso de cierre explícito, no mostrar una nueva alerta
    if (this.isExplicitlyClosing) return null;
    
    const alertId = this._generateAlertId();
    const totalSteps = steps.length;
    const progressPercent = ((currentStep + 1) / totalSteps) * 100;
    
    // Mensajes motivacionales para mostrar durante el proceso
    const motivationalMessages = [
      "Estamos trabajando para ti...",
      "Tu búsqueda sigue en proceso...",
      "Estamos trabajando a toda velocidad para resolver tus dudas...",
      "Analizando información científica relevante...",
      "Conectando con las mejores fuentes de evidencia médica...",
      "Buscando los estudios más recientes y relevantes...",
      "Evaluando la calidad metodológica de los artículos encontrados...",
      "Procesando resultados para ofrecerte la mejor evidencia científica..."
    ];
    
    // Mensajes específicos por paso
    const stepSpecificMessages = {
      0: ["Formulando tu pregunta en formato PICO...", "Preparando búsqueda inicial..."],
      1: ["Optimizando términos de búsqueda...", "Generando estrategia avanzada..."],
      2: ["Consultando bases de datos científicas...", "Esto puede tomar unos momentos...", "Conectando con PubMed...", "Buscando artículos relevantes..."],
      3: ["Evaluando relevancia de los resultados...", "Analizando metodología y conclusiones...", "Priorizando artículos según nivel de evidencia..."]
    };
    
    // Seleccionar un mensaje aleatorio apropiado para el paso actual
    const getRandomMessage = () => {
      const generalMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
      
      if (stepSpecificMessages[currentStep]) {
        const specificMessages = stepSpecificMessages[currentStep];
        const specificMessage = specificMessages[Math.floor(Math.random() * specificMessages.length)];
        return `<strong>${specificMessage}</strong><br>${generalMessage}`;
      }
      
      return `<strong>${generalMessage}</strong>`;
    };
    
    const messagesToShow = customMessage || getRandomMessage();
    
    // Preparar el HTML para los pasos
    const stepsHtml = steps.map((step, index) => {
      const status = index < currentStep ? 'completado' : 
                     index === currentStep ? 'en proceso' : 'pendiente';
      const statusClass = index < currentStep ? 'step-completed' : 
                          index === currentStep ? 'step-current' : 'step-pending';
      const stepIcon = index < currentStep ? '✓' : 
                       index === currentStep ? '●' : '○';
      
      const isCurrentInProgressStep = index === currentStep;
      const pulseClass = isCurrentInProgressStep ? 'pulse-animation' : '';
      
      // Indicador de tiempo estimado para el paso actual
      let timeIndicator = '';
      if (isCurrentInProgressStep && step.estimatedTime) {
        // Si el paso tiene un tiempo estimado, mostrarlo
        timeIndicator = `<span class="time-estimate">(aprox. ${Math.ceil(step.estimatedTime)} segundos)</span>`;
      } else if (isCurrentInProgressStep) {
        // Tiempos genéricos si no hay estimación específica
        if (currentStep === 2) { // Paso de búsqueda de artículos (más largo)
          timeIndicator = '<span class="time-estimate">(esto puede tomar 30-60 segundos)</span>';
        } else if (currentStep === 3) { // Paso de análisis
          timeIndicator = '<span class="time-estimate">(esto puede tomar 20-40 segundos)</span>';
        }
      }
      
      return `
        <div class="step ${statusClass}">
          <div class="step-number ${pulseClass}">${stepIcon}</div>
          <div class="step-content">
            <div class="step-title">${step.title} ${timeIndicator}</div>
            <div class="step-description">${step.description}</div>
          </div>
        </div>
      `;
    }).join('');
    
    const customStyle = `
      <style>
        .progress-bar {
          height: 8px;
          background-color: #f3f3f3;
          border-radius: 4px;
          margin-bottom: 20px;
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          background-color: #3498db;
          width: ${progressPercent}%;
          transition: width 0.5s;
        }
        .steps-container {
          text-align: left;
        }
        .step {
          display: flex;
          margin-bottom: 15px;
          align-items: flex-start;
        }
        .step-number {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 15px;
          flex-shrink: 0;
          font-weight: bold;
        }
        .step-completed .step-number {
          background-color: #2ecc71;
          color: white;
        }
        .step-current .step-number {
          background-color: #3498db;
          color: white;
          box-shadow: 0 0 10px rgba(52, 152, 219, 0.5);
        }
        .step-pending .step-number {
          background-color: #f3f3f3;
          color: #666;
        }
        .step-content {
          flex: 1;
        }
        .step-title {
          font-weight: bold;
          margin-bottom: 3px;
        }
        .step-description {
          font-size: 0.9em;
          color: #666;
        }
        .step-completed .step-title {
          color: #2ecc71;
        }
        .step-current .step-title {
          color: #3498db;
        }
        .time-estimate {
          font-size: 0.8em;
          color: #e67e22;
          font-weight: normal;
          margin-left: 5px;
        }
        .time-total-estimate {
          display: block;
          margin-top: 10px;
          padding: 6px 10px;
          background-color: #fffbf2;
          border: 1px solid #ffe0b2;
          border-radius: 4px;
          color: #e67e22;
          font-weight: 500;
          text-align: center;
          font-size: 0.9em;
        }
        .motivational-message {
          margin-top: 20px;
          padding: 15px;
          border-radius: 8px;
          background-color: #f8f9fa;
          border-left: 4px solid #3498db;
          font-size: 0.95em;
          text-align: center;
        }
        .pulse-animation {
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(52, 152, 219, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(52, 152, 219, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(52, 152, 219, 0);
          }
        }
        .spinner-container {
          display: flex;
          justify-content: center;
          margin: 15px 0;
        }
        .spinner {
          display: inline-block;
          width: 40px;
          height: 40px;
          border: 4px solid rgba(52, 152, 219, 0.3);
          border-radius: 50%;
          border-top-color: #3498db;
          animation: spin 1s ease-in-out infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    `;
    
    const contentHtml = `
      ${customStyle}
      <div class="progress-bar">
        <div class="progress-bar-fill"></div>
      </div>
      <div class="steps-container">
        ${stepsHtml}
      </div>
      <div class="spinner-container">
        <div class="spinner"></div>
      </div>
      <div class="motivational-message">
        ${messagesToShow}
      </div>
    `;
    
    let intervalId = null;
    
    const swalPromise = Swal.fire({
      title: 'Procesando su consulta',
      html: contentHtml,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: (popup) => {
        // Asignar el ID al popup
        if (popup) popup.setAttribute('data-alert-id', alertId);
        
        // Actualizar mensaje cada 8 segundos si estamos en paso 2 o 3 (los más largos)
        if (currentStep === 2 || currentStep === 3) {
          const messageElement = Swal.getHtmlContainer().querySelector('.motivational-message');
          const updateMessage = () => {
            // Solo actualizar si la alerta aún está visible
            if (document.body.contains(popup) && !this.isExplicitlyClosing) {
              messageElement.innerHTML = getRandomMessage();
            }
          };
          
          intervalId = setInterval(updateMessage, 8000);
          
          // Guardar el ID del intervalo para limpiarlo más tarde
          popup.setAttribute('data-interval-id', intervalId);
        }
      },
      willClose: () => {
        // Limpiar el intervalo al cerrar
        if (intervalId) {
          clearInterval(intervalId);
        }
        
        // Eliminar del registro de alertas activas
        delete this.activeAlerts[alertId];
      }
    });
    
    // Registrar la alerta con su intervalo
    this.activeAlerts[alertId] = { 
      alert: swalPromise, 
      intervalId: intervalId 
    };
    
    return alertId;
  }

  /**
   * Actualiza el paso actual en la notificación de flujo de proceso
   * @param {string} alertId - ID de la alerta de SweetAlert2
   * @param {Array} steps - Arreglo de pasos
   * @param {number} newCurrentStep - Nuevo paso actual
   * @param {string} customMessage - Mensaje personalizado opcional
   */
  updateProcessStep(alertId, steps, newCurrentStep, customMessage = '') {
    // Si estamos en proceso de cierre explícito, no actualizar
    if (this.isExplicitlyClosing) return;
    
    // Cerrar la alerta anterior de manera controlada
    if (alertId && this.activeAlerts[alertId]) {
      const oldIntervalId = this.activeAlerts[alertId].intervalId;
      if (oldIntervalId) {
        clearInterval(oldIntervalId);
      }
      
      // No establecer isExplicitlyClosing aquí para evitar que se bloquee la nueva alerta
      Swal.close();
      
      // Mostrar la alerta con el paso actualizado
      const newAlertId = this.showProcessSteps(steps, newCurrentStep, customMessage);
      
      // Reemplazar el ID de alerta en el caller
      return newAlertId;
    }
    
    // Si no hay alerta previa, simplemente mostrar una nueva
    return this.showProcessSteps(steps, newCurrentStep, customMessage);
  }

  /**
   * Muestra una notificación informativa
   * @param {string} title - Título de la notificación
   * @param {string} message - Mensaje de la notificación
   */
  showInfo(title, message) {
    // Si estamos en proceso de cierre explícito, no mostrar una nueva alerta
    if (this.isExplicitlyClosing) return null;
    
    const alertId = this._generateAlertId();
    
    const alert = Swal.fire({
      title: title,
      html: message,
      icon: 'info',
      confirmButtonText: 'Entendido',
      didOpen: (popup) => {
        // Asignar el ID al popup
        if (popup) popup.setAttribute('data-alert-id', alertId);
      }
    });
    
    // Registrar la alerta
    this.activeAlerts[alertId] = { alert, intervalId: null };
    
    return alertId;
  }
}

export default new NotificationService(); 