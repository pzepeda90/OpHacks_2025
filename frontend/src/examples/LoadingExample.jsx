import React, { useState } from 'react';
import { useLoading } from '../hooks/useLoading';
import { Loading } from '../components/Loading';
import LoadingWrapper from '../components/LoadingWrapper';
import './LoadingExample.css';

/**
 * Componente de ejemplo que demuestra cómo usar el hook useLoading
 * junto con el componente Loading para gestionar estados de carga
 */
const LoadingExample = () => {
  const { isLoading, error, withLoading } = useLoading();
  const [data, setData] = useState(null);

  // Simula una llamada a API con retraso
  const fetchData = async () => {
    return new Promise((resolve, reject) => {
      // Simulamos un 20% de probabilidad de error
      const shouldFail = Math.random() < 0.2;
      
      setTimeout(() => {
        if (shouldFail) {
          reject(new Error('Error al cargar los datos. Intente nuevamente.'));
        } else {
          resolve({
            message: 'Datos cargados exitosamente',
            timestamp: new Date().toLocaleTimeString()
          });
        }
      }, 1500); // 1.5 segundos de retraso
    });
  };

  const handleFetchData = () => {
    withLoading(
      async () => {
        const result = await fetchData();
        setData(result);
        return result;
      },
      {
        onSuccess: (result) => {
          console.log('Operación exitosa:', result);
        },
        onError: (err) => {
          console.error('Error en la operación:', err);
        }
      }
    );
  };

  return (
    <div className="loading-example">
      <h2>Ejemplo de Loading y useLoading</h2>
      
      <button 
        onClick={handleFetchData} 
        disabled={isLoading}
        className="fetch-button"
      >
        {isLoading ? 'Cargando...' : 'Cargar datos'}
      </button>
      
      <div className="loading-wrapper">
        <Loading 
          isLoading={isLoading} 
          text="Obteniendo datos..." 
          error={error?.message}
        />
      </div>
      
      {data && !isLoading && !error && (
        <div className="data-result">
          <h3>Datos recibidos:</h3>
          <p>{data.message}</p>
          <p className="timestamp">Hora: {data.timestamp}</p>
        </div>
      )}
      
      <div className="usage-example">
        <h3>Cómo usar este componente:</h3>
        <pre>{`
// 1. Importar el hook y el componente
import { useLoading } from '../hooks/useLoading';
import { Loading } from '../components/Loading';

// 2. Usar el hook en tu componente
const { isLoading, error, withLoading } = useLoading();

// 3. Usar withLoading para envolver operaciones asíncronas
const handleSubmit = () => {
  withLoading(async () => {
    // Tu código asíncrono aquí
    const data = await fetchSomething();
    return data;
  });
};

// 4. Usar el componente Loading
return (
  <div>
    <Loading 
      isLoading={isLoading}
      text="Procesando..."
      error={error?.message}
    />
  </div>
);
        `}</pre>
      </div>
    </div>
  );
};

export default LoadingExample; 