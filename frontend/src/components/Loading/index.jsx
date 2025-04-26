import React from 'react';
import PropTypes from 'prop-types';
import './styles.css';

/**
 * Componente Loading - Muestra un indicador de carga con texto personalizable
 * 
 * @param {boolean} isLoading - Indica si el contenido está cargando
 * @param {string} text - Texto a mostrar durante la carga
 * @param {string|null} error - Mensaje de error a mostrar (si existe)
 * @param {string} className - Clase CSS adicional para el contenedor
 * @param {object} style - Estilos en línea adicionales
 */
const Loading = ({ isLoading, text, error, className, style }) => {
  if (!isLoading && !error) return null;

  return (
    <div className={`loading-container ${className || ''}`} style={style}>
      {isLoading && (
        <>
          <div className="loading-spinner">
            <div className="loading-circle"></div>
          </div>
          {text && <p className="loading-text">{text}</p>}
        </>
      )}
      
      {error && <p className="loading-error">{error}</p>}
    </div>
  );
};

Loading.propTypes = {
  isLoading: PropTypes.bool,
  text: PropTypes.string,
  error: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object
};

Loading.defaultProps = {
  isLoading: false,
  text: 'Cargando...',
  error: null,
  className: '',
  style: {}
};

export default Loading; 