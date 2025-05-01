import { useState } from "react";
import "./App.css";
import Navbar from "./components/Navbar/Navbar";
import Main from "./components/Main/Main";
import Footer from "./components/Footer/Footer";

// Función para logs detallados
const logInfo = (component, message, data) => {
  const timestamp = new Date().toISOString();
  console.log(`[APP ${timestamp}] [${component}] ${message}`);
  if (data) console.log(data);
};

const logError = (component, message, error) => {
  const timestamp = new Date().toISOString();
  console.error(`[APP ERROR ${timestamp}] [${component}] ${message}`);
  if (error) {
    console.error('Mensaje de error:', error.message);
    console.error('Stack:', error.stack);
    if (error.response) {
      console.error('Datos de respuesta:', error.response.data);
      console.error('Status:', error.response.status);
    }
  }
};

const App = () => {
  const [iaEnabled, setIaEnabled] = useState(true);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [apiBaseUrl] = useState('/api'); // URL base para las APIs del backend

  const handleSearch = async (searchQuery, searchStrategy = "") => {
    const component = 'handleSearch';
    logInfo(component, `Iniciando búsqueda: "${searchQuery}"`, {
      iaEnabled,
      searchStrategy: searchStrategy?.substring(0, 100) + (searchStrategy?.length > 100 ? '...' : '')
    });
    
    setQuery(searchQuery);
    
    try {
      setIsLoading(true);
      
      // Realizar la petición real al backend
      logInfo(component, 'Enviando solicitud al backend', {
        endpoint: `${apiBaseUrl}/scientific-query`,
        params: {
          question: searchQuery,
          useAI: iaEnabled,
          searchStrategy
        }
      });
      
      const startTime = Date.now();
      
      const response = await fetch(`${apiBaseUrl}/scientific-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: searchQuery,
          useAI: iaEnabled,
          searchStrategy: searchStrategy || undefined
        })
      });
      
      const endTime = Date.now();
      logInfo(component, `Respuesta recibida en ${endTime - startTime}ms, status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        logError(component, `Error en respuesta del servidor: ${response.status}`, {
          status: response.status,
          text: errorText
        });
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      logInfo(component, 'Datos recibidos', {
        success: data.success !== false, 
        resultCount: data.results?.length || 0,
        query: data.query
      });
      
      // Guardar resultados
      setResults(data);
      setIsLoading(false);
      
      // Devolver los datos para que el componente Main pueda usarlos
      return data;
      
    } catch (error) {
      logError(component, "Error en la búsqueda", error);
      setIsLoading(false);
      throw error;
    }
  };

  const handleToggleIA = (enabled) => {
    logInfo('handleToggleIA', `IA ${enabled ? 'activada' : 'desactivada'}`);
    setIaEnabled(enabled);
  };

  return (
    <div className="app-container">
      <Navbar />
      <Main 
        onSearch={handleSearch} 
        onToggleIA={handleToggleIA} 
        iaEnabled={iaEnabled}
      />
      <Footer />
    </div>
  );
};

export default App;
