import React from 'react';
import PropTypes from 'prop-types';
import { Loading } from '../Loading';
import './styles.css';

/**
 * Componente LoadingWrapper - Envuelve contenido con un estado de carga
 * Muestra el indicador de carga cuando isLoading es true, o el contenido cuando es false
 * 
 * @param {boolean} isLoading - Indica si el contenido está cargando
 * @param {string} loadingText - Texto a mostrar durante la carga
 * @param {string|null} error - Mensaje de error a mostrar (si existe)
 * @param {React.ReactNode} children - Contenido a mostrar cuando no está cargando
 * @param {string} className - Clase CSS adicional para el contenedor
 * @param {object} style - Estilos en línea adicionales
 */
const LoadingWrapper = ({ 
  isLoading, 
  loadingText, 
  error, 
  children, 
  className, 
  style,
  minHeight
}) => {
  return (
    <div 
      className={`loading-wrapper ${className || ''}`} 
      style={{ ...style, minHeight: minHeight || '120px' }}
    >
      <Loading
        isLoading={isLoading}
        text={loadingText}
        error={error}
      />
      
      {!isLoading && !error && children}
    </div>
  );
};

LoadingWrapper.propTypes = {
  isLoading: PropTypes.bool,
  loadingText: PropTypes.string,
  error: PropTypes.string,
  children: PropTypes.node,
  className: PropTypes.string,
  style: PropTypes.object,
  minHeight: PropTypes.string
};

LoadingWrapper.defaultProps = {
  isLoading: false,
  loadingText: 'Cargando...',
  error: null,
  className: '',
  style: {},
  minHeight: '120px'
};

export default LoadingWrapper; 