import React, { useState } from 'react';
import './DiagnosisPanel.css';

/**
 * Panel de diagnóstico para visualizar y monitorear el proceso de búsqueda científica
 * Solo visible en entorno de desarrollo
 */
const renderSocketInfo = (socketStatus) => {
  if (!socketStatus) return null;
  
  return (
    <div className="socket-info">
      <h4>Socket.IO Status</h4>
      <div className="socket-status">
        <div className={`status-indicator ${socketStatus.connected ? 'connected' : 'disconnected'}`}></div>
        <span>{socketStatus.connected ? 'Conectado' : 'Desconectado'}</span>
      </div>
      
      {socketStatus.error && (
        <div className="socket-error">
          <p>Error: {socketStatus.error}</p>
        </div>
      )}
      
      {socketStatus.lastMessage && (
        <div className="socket-message">
          <p>Último mensaje: {socketStatus.lastMessage}</p>
        </div>
      )}
    </div>
  );
};

const DiagnosisPanel = ({ 
  query,
  iaEnabled,
  loading,
  articles,
  apiResponse,
  error,
  searchStrategy,
  socketStatus,
  onTestPubmed
}) => {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  // Contar artículos con análisis
  const articlesWithAnalysis = articles?.filter(a => a.secondaryAnalysis)?.length || 0;

  return (
    <div className="diagnosis-panel">
      <div className="diagnosis-header" onClick={() => setExpanded(!expanded)}>
        <h3>Panel de Diagnóstico {expanded ? '⬆' : '⬇'}</h3>
        {!expanded && (
          <div className="diagnosis-mini-status">
            {loading ? '⌛' : error ? '❌' : articles.length > 0 ? '✅' : '⚪'} | 
            IA: {iaEnabled ? '🧠' : '👤'} | 
            Artículos: {articles.length}
          </div>
        )}
      </div>

      {expanded && (
        <div className="diagnosis-content">
          <div className="diagnosis-tabs">
            <button 
              className={activeTab === 'overview' ? 'active' : ''} 
              onClick={() => setActiveTab('overview')}>
              Vista General
            </button>
            <button 
              className={activeTab === 'flow' ? 'active' : ''} 
              onClick={() => setActiveTab('flow')}>
              Flujo Completo
            </button>
            <button 
              className={activeTab === 'response' ? 'active' : ''} 
              onClick={() => setActiveTab('response')}>
              Respuesta API
            </button>
            <button 
              className={activeTab === 'strategy' ? 'active' : ''} 
              onClick={() => setActiveTab('strategy')}>
              Estrategia
            </button>
          </div>

          <div className="diagnosis-tab-content">
            {activeTab === 'overview' && (
              <div className="diagnosis-overview">
                {renderSocketInfo(socketStatus)}
                <div className="diagnosis-item">
                  <strong>Estado:</strong> {loading ? 'Cargando' : 'Inactivo'}
                </div>
                <div className="diagnosis-item">
                  <strong>Modo IA:</strong> {iaEnabled ? 'Activado' : 'Desactivado'}
                </div>
                <div className="diagnosis-item">
                  <strong>Consulta:</strong> {query || 'No hay consulta activa'}
                </div>
                <div className="diagnosis-item">
                  <strong>Artículos cargados:</strong> {articles.length}
                </div>
                <div className="diagnosis-item">
                  <strong>Artículos con análisis:</strong> {articlesWithAnalysis}
                </div>
                {error && (
                  <div className="diagnosis-error">
                    <strong>Error:</strong> {error.message || 'Error desconocido'}
                  </div>
                )}
                <div className="diagnosis-actions">
                  <button onClick={() => console.clear()}>
                    Limpiar Consola
                  </button>
                  <button onClick={() => {
                    console.log('=== DIAGNÓSTICO ===');
                    console.log('Estado actual:', { 
                      query, 
                      iaEnabled, 
                      loading, 
                      articles, 
                      apiResponse, 
                      error,
                      searchStrategy: searchStrategy?.substring(0, 100) + '...'
                    });
                  }}>
                    Imprimir Estado
                  </button>
                  <button onClick={onTestPubmed}>
                    Probar PubMed
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'flow' && (
              <div className="diagnosis-flow">
                <h4>Flujo completo del proceso:</h4>
                <ol className="diagnosis-flow-steps">
                  <li className={query ? 'completed' : ''}>
                    <span>Usuario introduce pregunta clínica</span>
                    {query && <span className="flow-status">✓</span>}
                    <div className="flow-details">
                      <small>"{query}"</small>
                    </div>
                  </li>
                  
                  <li className={iaEnabled && searchStrategy ? 'completed' : iaEnabled ? 'in-progress' : ''}>
                    <span>Claude analiza la pregunta y genera estrategia de búsqueda</span>
                    {searchStrategy && <span className="flow-status">✓</span>}
                    {iaEnabled && !searchStrategy && loading && <span className="flow-status">⌛</span>}
                    {iaEnabled && <div className="flow-details">
                      <small>Modo IA activado</small>
                    </div>}
                  </li>
                  
                  <li className={apiResponse ? 'completed' : loading ? 'in-progress' : ''}>
                    <span>Backend consulta a PubMed con la estrategia generada</span>
                    {apiResponse && <span className="flow-status">✓</span>}
                    {!apiResponse && loading && <span className="flow-status">⌛</span>}
                    <div className="flow-details">
                      <small>Endpoint: /api/scientific-query</small>
                    </div>
                  </li>
                  
                  <li className={articles.length > 0 ? 'completed' : apiResponse ? 'in-progress' : ''}>
                    <span>PubMed devuelve artículos relevantes</span>
                    {articles.length > 0 && <span className="flow-status">✓</span>}
                    <div className="flow-details">
                      <small>Artículos: {articles.length}</small>
                    </div>
                  </li>
                  
                  <li className={articlesWithAnalysis > 0 ? 'completed' : (iaEnabled && articles.length > 0) ? 'in-progress' : ''}>
                    <span>Claude analiza cada artículo y evalúa relevancia (1-5)</span>
                    {articlesWithAnalysis > 0 && <span className="flow-status">✓</span>}
                    {iaEnabled && articles.length > 0 && articlesWithAnalysis === 0 && loading && <span className="flow-status">⌛</span>}
                    <div className="flow-details">
                      <small>Artículos analizados: {articlesWithAnalysis}/{articles.length}</small>
                    </div>
                  </li>
                  
                  <li className={articles.length > 0 && !loading ? 'completed' : ''}>
                    <span>Se muestran los artículos ordenados por puntuación</span>
                    {articles.length > 0 && !loading && <span className="flow-status">✓</span>}
                  </li>
                </ol>
              </div>
            )}

            {activeTab === 'response' && (
              <div className="diagnosis-response">
                <h4>Respuesta de la API:</h4>
                {apiResponse ? (
                  <div className="diagnosis-api-data">
                    <div className="diagnosis-api-header">
                      {apiResponse.success 
                        ? <span className="success">✅ Éxito - {apiResponse.count || 0} resultados</span> 
                        : <span className="error">❌ Error - {apiResponse.message || ''}</span>}
                    </div>
                    
                    {apiResponse.results && (
                      <div className="diagnosis-api-body">
                        <div><strong>Query original:</strong> {apiResponse.query?.original}</div>
                        <div><strong>Query procesada:</strong> {apiResponse.query?.processed || 'No procesada'}</div>
                        <div><strong>IA usada:</strong> {apiResponse.query?.useAI ? 'Sí' : 'No'}</div>
                        <div><strong>Tiempo de procesamiento:</strong> {apiResponse.processingTime ? `${apiResponse.processingTime}ms` : 'No disponible'}</div>
                        
                        {apiResponse.results.length > 0 && (
                          <div className="diagnosis-api-results">
                            <strong>Artículos ({apiResponse.results.length}):</strong>
                            <ul>
                              {apiResponse.results.slice(0, 3).map((article, index) => (
                                <li key={article.pmid || index}>
                                  <strong>PMID {article.pmid}:</strong> {article.title?.substring(0, 50)}...
                                  {article.secondaryAnalysis && <span className="analysis-indicator">📊</span>}
                                </li>
                              ))}
                              {apiResponse.results.length > 3 && <li>... y {apiResponse.results.length - 3} más</li>}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="diagnosis-no-data">No hay datos de respuesta disponibles</div>
                )}
              </div>
            )}

            {activeTab === 'strategy' && (
              <div className="diagnosis-strategy">
                <h4>Estrategia de búsqueda:</h4>
                {searchStrategy ? (
                  <div className="diagnosis-strategy-content">
                    <pre>{searchStrategy}</pre>
                    <button onClick={() => {
                      navigator.clipboard.writeText(searchStrategy);
                      alert('Estrategia copiada al portapapeles');
                    }}>
                      Copiar
                    </button>
                  </div>
                ) : (
                  <div className="diagnosis-no-data">No hay estrategia de búsqueda disponible</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DiagnosisPanel; 