import axios from 'axios';
import config from '../config/index.js';

class PubMedService {
  constructor() {
    this.baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
    this.apiKey = config.apis.pubmed.apiKey;
    console.log(`Servicio PubMed inicializado con URL base: ${this.baseUrl}`);
    console.log(`API Key configurada: ${this.apiKey ? '****' + this.apiKey.substring(this.apiKey.length - 4) : 'NO CONFIGURADA'}`);
  }

  async search(query, maxResults = 20) {
    console.log('===== PUBMED: INICIANDO BÚSQUEDA =====');
    console.log(`Query de búsqueda: "${query}"`);
    console.log(`Límite de resultados: ${maxResults}`);
    
    try {
      // Primera llamada: buscar IDs de artículos
      console.log('PASO 1: Búsqueda de IDs de artículos (esearch.fcgi)');
      const searchUrl = `${this.baseUrl}/esearch.fcgi`;
      const searchParams = {
        db: 'pubmed',
        term: query,
        retmax: maxResults,
        sort: 'relevance',
        retmode: 'json',
        api_key: this.apiKey
      };

      console.log(`URL completa: ${searchUrl}`);
      console.log(`Parámetros: ${JSON.stringify({...searchParams, api_key: '****'})}`);
      
      const startTimeSearch = Date.now();
      let searchResponse;
      try {
        searchResponse = await axios.get(searchUrl, { params: searchParams });
        const endTimeSearch = Date.now();
        console.log(`Tiempo de respuesta esearch: ${endTimeSearch - startTimeSearch}ms`);
        console.log(`Código de estado HTTP: ${searchResponse.status}`);
      } catch (searchError) {
        console.error('ERROR en llamada a esearch.fcgi:');
        console.error(`- Mensaje: ${searchError.message}`);
        if (searchError.response) {
          console.error(`- Estado HTTP: ${searchError.response.status}`);
          console.error(`- Datos: ${JSON.stringify(searchError.response.data)}`);
        }
        throw new Error(`Error en búsqueda de PubMed esearch: ${searchError.message}`);
      }
      
      if (!searchResponse.data || !searchResponse.data.esearchresult) {
        console.error('Respuesta inválida de PubMed API (esearch):', JSON.stringify(searchResponse.data));
        return [];
      }
      
      const idList = searchResponse.data.esearchresult.idlist;
      console.log(`IDs de artículos encontrados: ${idList?.length || 0}`);
      if (idList && idList.length > 0) {
        console.log(`Muestra de IDs: ${idList.slice(0, 5).join(', ')}${idList.length > 5 ? '...' : ''}`);
      }

      if (!idList || idList.length === 0) {
        console.log('No se encontraron resultados para esta búsqueda');
        console.log('===== PUBMED: BÚSQUEDA FINALIZADA (SIN RESULTADOS) =====');
        return [];
      }

      // Segunda llamada: obtener detalles de los artículos
      console.log('PASO 2: Obtención de resúmenes de artículos (esummary.fcgi)');
      const summaryUrl = `${this.baseUrl}/esummary.fcgi`;
      const summaryParams = {
        db: 'pubmed',
        id: idList.join(','),
        retmode: 'json',
        api_key: this.apiKey
      };

      console.log(`URL completa: ${summaryUrl}`);
      console.log(`IDs solicitados: ${idList.length}`);
      
      const startTimeSummary = Date.now();
      let summaryResponse;
      try {
        summaryResponse = await axios.get(summaryUrl, { params: summaryParams });
        const endTimeSummary = Date.now();
        console.log(`Tiempo de respuesta esummary: ${endTimeSummary - startTimeSummary}ms`);
        console.log(`Código de estado HTTP: ${summaryResponse.status}`);
      } catch (summaryError) {
        console.error('ERROR en llamada a esummary.fcgi:');
        console.error(`- Mensaje: ${summaryError.message}`);
        if (summaryError.response) {
          console.error(`- Estado HTTP: ${summaryError.response.status}`);
          console.error(`- Datos: ${JSON.stringify(summaryError.response.data)}`);
        }
        throw new Error(`Error en búsqueda de resúmenes de PubMed: ${summaryError.message}`);
      }
      
      if (!summaryResponse.data || !summaryResponse.data.result) {
        console.error('Respuesta inválida de PubMed Summary API');
        console.error(`Datos recibidos: ${JSON.stringify(summaryResponse.data)}`);
        return [];
      }
      
      const result = summaryResponse.data.result;
      console.log(`Resúmenes recibidos: ${Object.keys(result).length - 1}`); // -1 por la propiedad 'uids'

      // Tercera llamada: obtener abstract para cada artículo
      console.log('PASO 3: Obtención de abstracts y términos MeSH (efetch.fcgi)');
      const articlesWithAbstracts = await Promise.all(
        idList.map(async (pmid, index) => {
          try {
            console.log(`[${index + 1}/${idList.length}] Procesando artículo PMID: ${pmid}`);
            const articleData = result[pmid];
            if (!articleData) {
              console.error(`No se encontraron datos para PMID ${pmid}`);
              return null;
            }
            
            const efetchUrl = `${this.baseUrl}/efetch.fcgi`;
            const efetchParams = {
              db: 'pubmed',
              id: pmid,
              retmode: 'xml',
              api_key: this.apiKey
            };

            const startTimeEfetch = Date.now();
            let efetchResponse;
            try {
              efetchResponse = await axios.get(efetchUrl, { params: efetchParams });
              const endTimeEfetch = Date.now();
              console.log(`Tiempo de respuesta efetch para PMID ${pmid}: ${endTimeEfetch - startTimeEfetch}ms`);
            } catch (efetchError) {
              console.error(`ERROR en llamada a efetch.fcgi para PMID ${pmid}:`);
              console.error(`- Mensaje: ${efetchError.message}`);
              if (efetchError.response) {
                console.error(`- Estado HTTP: ${efetchError.response.status}`);
              }
              return null;
            }
            
            // Extraer abstract con una expresión regular más robusta
            const abstractMatch = efetchResponse.data.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/);
            const abstractText = abstractMatch ? abstractMatch[1] : 'Abstract no disponible';
            console.log(`PMID ${pmid} - Abstract: ${abstractText.substring(0, 50)}...`);
            
            // Extraer términos MeSH
            const meshTermsMatch = efetchResponse.data.match(/<DescriptorName[^>]*>(.*?)<\/DescriptorName>/g);
            const meshTerms = meshTermsMatch
              ? meshTermsMatch.map(term => {
                  const match = term.match(/<DescriptorName[^>]*>(.*?)<\/DescriptorName>/);
                  return match ? match[1] : null;
                }).filter(Boolean)
              : [];
            
            console.log(`PMID ${pmid} - Términos MeSH encontrados: ${meshTerms.length}`);
            if (meshTerms.length > 0) {
              console.log(`PMID ${pmid} - Muestra de términos MeSH: ${meshTerms.slice(0, 3).join(', ')}${meshTerms.length > 3 ? '...' : ''}`);
            }

            const articleResult = {
              pmid: pmid,
              doi: articleData.articleids?.find(id => id.idtype === 'doi')?.value || null,
              title: articleData.title || 'Sin título',
              authors: articleData.authors?.map(author => ({
                name: author.name,
                authtype: author.authtype
              })) || [],
              publicationDate: articleData.pubdate || 'Fecha desconocida',
              abstract: abstractText,
              meshTerms: meshTerms
            };
            
            console.log(`PMID ${pmid} - Artículo procesado exitosamente: "${articleResult.title.substring(0, 50)}..."`);
            return articleResult;
          } catch (error) {
            console.error(`Error obteniendo detalles para PMID ${pmid}:`, error);
            return null;
          }
        })
      );

      const filteredResults = articlesWithAbstracts.filter(Boolean);
      console.log(`Resultados totales procesados exitosamente: ${filteredResults.length} de ${idList.length} encontrados`);
      console.log('===== PUBMED: BÚSQUEDA FINALIZADA EXITOSAMENTE =====');
      
      return filteredResults;
    } catch (error) {
      console.error('===== PUBMED: ERROR EN BÚSQUEDA =====');
      console.error(`Error general: ${error.message}`);
      console.error(`Stack: ${error.stack}`);
      console.error('=========================================');
      throw new Error('Error al buscar en PubMed: ' + (error.message || 'Error desconocido'));
    }
  }
}

export default new PubMedService(); 