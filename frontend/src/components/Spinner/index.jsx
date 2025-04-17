import React from 'react';
import './Spinner.css';

/**
 * Componente que muestra un indicador de carga animado
 * Se utiliza cuando hay operaciones asíncronas en progreso
 */
const Spinner = () => {
  return (
    <div className="spinner">
      <div className="spinner-inner">
        <div className="spinner-circle"></div>
        <div className="spinner-circle-outer"></div>
      </div>
    </div>
  );
};

export default Spinner; 