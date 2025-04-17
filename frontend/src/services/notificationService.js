import Swal from 'sweetalert2/dist/sweetalert2.js';
import 'sweetalert2/dist/sweetalert2.css';

/**
 * Servicio para mostrar notificaciones y alertas con SweetAlert2
 */
class NotificationService {
  /**
   * Muestra una notificación de proceso en curso
   * @param {string} title - Título de la notificación
   * @param {string} message - Mensaje de la notificación
   * @returns {object} - Objeto de SweetAlert2 para controlar la alerta
   */
  showProcessNotification(title, message) {
    return Swal.fire({
      title: title,
      html: message,
      icon: 'info',
      allowOutsideClick: false,
      allowEscapeKey: false,
      allowEnterKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
  }

  /**
   * Actualiza una notificación existente
   * @param {object} alert - Objeto de alerta de SweetAlert2
   * @param {string} title - Nuevo título
   * @param {string} message - Nuevo mensaje
   * @param {string} icon - Nuevo icono (info, success, warning, error)
   */
  updateNotification(alert, title, message, icon = 'info') {
    if (alert) {
      Swal.update({
        title: title,
        html: message,
        icon: icon
      });
    }
  }

  /**
   * Cierra una notificación existente
   * @param {object} alert - Objeto de alerta de SweetAlert2
   */
  closeNotification(alert) {
    if (alert) {
      Swal.close();
    }
  }

  /**
   * Muestra una notificación de éxito
   * @param {string} title - Título de la notificación
   * @param {string} message - Mensaje de la notificación
   */
  showSuccess(title, message) {
    return Swal.fire({
      title: title,
      html: message,
      icon: 'success',
      timer: 2000,
      timerProgressBar: true,
      showConfirmButton: false
    });
  }

  /**
   * Muestra una notificación de error
   * @param {string} title - Título de la notificación
   * @param {string} message - Mensaje de la notificación
   */
  showError(title, message) {
    return Swal.fire({
      title: title,
      html: message,
      icon: 'error',
      confirmButtonText: 'Entendido'
    });
  }

  /**
   * Muestra una notificación de flujo de proceso
   * Esta notificación muestra cada paso del proceso con un indicador de progreso
   * @param {Array} steps - Arreglo de pasos a mostrar
   * @param {number} currentStep - Paso actual (índice del arreglo steps)
   */
  showProcessSteps(steps, currentStep = 0) {
    const totalSteps = steps.length;
    const progressPercent = ((currentStep + 1) / totalSteps) * 100;
    
    const stepsHtml = steps.map((step, index) => {
      const status = index < currentStep ? 'completado' : 
                     index === currentStep ? 'en proceso' : 'pendiente';
      const statusClass = index < currentStep ? 'step-completed' : 
                          index === currentStep ? 'step-current' : 'step-pending';
      
      return `
        <div class="step ${statusClass}">
          <div class="step-number">${index + 1}</div>
          <div class="step-content">
            <div class="step-title">${step.title}</div>
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
          transition: width 0.3s;
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
    `;
    
    return Swal.fire({
      title: 'Procesando su consulta',
      html: contentHtml,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false
    });
  }

  /**
   * Actualiza el paso actual en la notificación de flujo de proceso
   * @param {object} alert - Objeto de alerta de SweetAlert2
   * @param {Array} steps - Arreglo de pasos
   * @param {number} newCurrentStep - Nuevo paso actual
   */
  updateProcessStep(alert, steps, newCurrentStep) {
    if (alert) {
      this.showProcessSteps(steps, newCurrentStep);
    }
  }
}

export default new NotificationService(); 