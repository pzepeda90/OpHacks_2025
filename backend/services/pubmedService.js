/**
 * Servicio para interactuar con la API de PubMed
 */
import axios from 'axios';
import config from '../config/index.js';
import Article from '../models/Article.js';

class PubMedService {
  constructor() {
    this.baseUrl = config.apis.pubmed.baseUrl;
    this.apiKey = config.apis.pubmed.apiKey;
    this.maxResults = config.apis.pubmed.maxResults;
  }

  /**
   * Busca artículos en PubMed basado en una consulta
   * @param {string} query - Consulta de búsqueda
   * @param {number} maxResults - Máximo número de resultados a devolver
   * @returns {Promise<Array>} - Lista de artículos encontrados
   */
  async search(query, maxResults = this.maxResults) {
    try {
      console.log('===== PUBMED: INICIANDO BÚSQUEDA =====');
      console.log(`Consulta: "${query}"`);
      console.log(`Máximo de resultados: ${maxResults}`);
      
      // PASO 1: Realizar búsqueda inicial
      console.log('PASO 1: Búsqueda inicial (esearch.fcgi)');
      const searchUrl = `${this.baseUrl}/esearch.fcgi`;
      const searchParams = {
        db: 'pubmed',
        term: query,
        retmax: maxResults,
        retmode: 'json',
        sort: 'relevance',
        api_key: this.apiKey
      };

      const startTimeSearch = Date.now();
      let searchResponse;
      try {
        searchResponse = await axios.get(searchUrl, { params: searchParams });
        const endTimeSearch = Date.now();
        console.log(`Tiempo de respuesta esearch: ${endTimeSearch - startTimeSearch}ms`);
      } catch (searchError) {
        console.error('ERROR en llamada a esearch.fcgi:');
        console.error(`- Mensaje: ${searchError.message}`);
        if (searchError.response) {
          console.error(`- Estado HTTP: ${searchError.response.status}`);
        }
        throw new Error('Error en búsqueda inicial de PubMed: ' + searchError.message);
      }
      
      // Extraer IDs de resultados
      const esearchResult = searchResponse.data.esearchresult;
      const idList = esearchResult.idlist || [];
      const count = parseInt(esearchResult.count, 10);
      
      console.log(`Total de resultados encontrados: ${count}`);
      console.log(`IDs recuperados en esta consulta: ${idList.length}`);
      
      if (idList.length === 0) {
        console.log('No se encontraron resultados para la consulta');
        console.log('===== PUBMED: BÚSQUEDA FINALIZADA SIN RESULTADOS =====');
        return [];
      }
      
      // PASO 2: Obtener resumen de artículos
      console.log('PASO 2: Obtención de resúmenes (esummary.fcgi)');
      const summaryUrl = `${this.baseUrl}/esummary.fcgi`;
      const summaryParams = {
        db: 'pubmed',
        id: idList.join(','),
        retmode: 'json',
        api_key: this.apiKey
      };
      
      const startTimeSummary = Date.now();
      let summaryResponse;
      try {
        summaryResponse = await axios.get(summaryUrl, { params: summaryParams });
        const endTimeSummary = Date.now();
        console.log(`Tiempo de respuesta esummary: ${endTimeSummary - startTimeSummary}ms`);
      } catch (summaryError) {
        console.error('ERROR en llamada a esummary.fcgi:');
        console.error(`- Mensaje: ${summaryError.message}`);
        if (summaryError.response) {
          console.error(`- Estado HTTP: ${summaryError.response.status}`);
        }
        throw new Error('Error al obtener resúmenes de PubMed: ' + summaryError.message);
      }
      
      if (!summaryResponse.data.result) {
        console.error('La respuesta no contiene resultados');
        console.log('===== PUBMED: ERROR EN BÚSQUEDA =====');
        return [];
      }
      
      const result = summaryResponse.data.result;
      console.log(`Resúmenes recibidos: ${Object.keys(result).length - 1}`); // -1 por la propiedad 'uids'

      // PASO 3: Obtener abstract y términos MeSH para cada artículo
      console.log('PASO 3: Obtención de abstracts y términos MeSH (efetch.fcgi)');
      
      // Procesar cada artículo
      const articlesWithAbstracts = await Promise.all(
        idList.map(async (pmid, index) => {
          try {
            console.log(`[${index + 1}/${idList.length}] Procesando artículo PMID: ${pmid}`);
            const articleData = result[pmid];
            if (!articleData) {
              console.error(`No se encontraron datos para PMID ${pmid}`);
              return null;
            }
            
            // Obtener abstract y términos MeSH
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
            
            // Extraer abstract
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
            
            // Crear objeto de artículo
            const rawArticleData = {
              pmid: pmid,
              doi: articleData.articleids?.find(id => id.idtype === 'doi')?.value || null,
              title: this._sanitizeTitle(articleData.title),
              authors: this._processAuthors(articleData.authors),
              pubdate: articleData.pubdate || 'Fecha desconocida',
              abstract: this._sanitizeText(abstractText),
              meshTerms: meshTerms,
              source: articleData.source || null
            };
            
            // Usar el modelo Article para estandarizar el formato
            const article = new Article(rawArticleData);
            
            console.log(`PMID ${pmid} - Artículo procesado exitosamente: "${article.title.substring(0, 50)}..."`);
            return article;
          } catch (error) {
            console.error(`Error obteniendo detalles para PMID ${pmid}:`, error);
            return null;
          }
        })
      );

      // Filtrar resultados nulos
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

  /**
   * Busca detalles de un artículo específico por PMID
   * @param {string} pmid - ID de PubMed
   * @returns {Promise<Object>} - Artículo encontrado
   */
  async getArticleByPmid(pmid) {
    try {
      console.log(`===== PUBMED: BUSCANDO ARTÍCULO PMID: ${pmid} =====`);
      
      // Obtener resumen
      const summaryUrl = `${this.baseUrl}/esummary.fcgi`;
      const summaryParams = {
        db: 'pubmed',
        id: pmid,
        retmode: 'json',
        api_key: this.apiKey
      };
      
      const summaryResponse = await axios.get(summaryUrl, { params: summaryParams });
      
      if (!summaryResponse.data.result || !summaryResponse.data.result[pmid]) {
        console.error(`No se encontró artículo con PMID: ${pmid}`);
        return null;
      }
      
      const articleData = summaryResponse.data.result[pmid];
      
      // Obtener abstract y términos MeSH
      const efetchUrl = `${this.baseUrl}/efetch.fcgi`;
      const efetchParams = {
        db: 'pubmed',
        id: pmid,
        retmode: 'xml',
        api_key: this.apiKey
      };
      
      const efetchResponse = await axios.get(efetchUrl, { params: efetchParams });
      
      // Extraer abstract
      const abstractMatch = efetchResponse.data.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/);
      const abstractText = abstractMatch ? abstractMatch[1] : 'Abstract no disponible';
      
      // Extraer términos MeSH
      const meshTermsMatch = efetchResponse.data.match(/<DescriptorName[^>]*>(.*?)<\/DescriptorName>/g);
      const meshTerms = meshTermsMatch
        ? meshTermsMatch.map(term => {
            const match = term.match(/<DescriptorName[^>]*>(.*?)<\/DescriptorName>/);
            return match ? match[1] : null;
          }).filter(Boolean)
        : [];
      
      // Crear objeto de artículo
      const rawArticleData = {
        pmid: pmid,
        doi: articleData.articleids?.find(id => id.idtype === 'doi')?.value || null,
        title: this._sanitizeTitle(articleData.title),
        authors: this._processAuthors(articleData.authors),
        pubdate: articleData.pubdate || 'Fecha desconocida',
        abstract: this._sanitizeText(abstractText),
        meshTerms: meshTerms,
        source: articleData.source || null
      };
      
      // Usar el modelo Article para estandarizar el formato
      const article = new Article(rawArticleData);
      
      console.log(`Artículo PMID ${pmid} recuperado exitosamente`);
      console.log('===== PUBMED: BÚSQUEDA DE ARTÍCULO FINALIZADA =====');
      
      return article;
    } catch (error) {
      console.error(`===== PUBMED: ERROR AL BUSCAR ARTÍCULO PMID: ${pmid} =====`);
      console.error(`Error: ${error.message}`);
      throw new Error(`Error al buscar artículo PMID ${pmid}: ${error.message}`);
    }
  }

  /**
   * Sanitiza el título eliminando etiquetas HTML y decodificando entidades
   * @private
   * @param {string} title - Título original
   * @returns {string} - Título procesado
   */
  _sanitizeTitle(title) {
    if (!title) return 'Sin título';
    
    // Limpiar y eliminar etiquetas HTML y decodificar entidades HTML básicas
    const cleanedTitle = title
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    
    // Verificar si es título genérico o muy corto
    const isGeneric = (
      !cleanedTitle || 
      cleanedTitle.length < 5 || 
      cleanedTitle.toLowerCase() === 'retinal detachment' ||
      cleanedTitle.toLowerCase() === 'desprendimiento de retina' ||
      cleanedTitle.toLowerCase() === 'sin título' ||
      cleanedTitle.toLowerCase() === 'untitled' ||
      cleanedTitle.toLowerCase() === 'n/a'
    );
    
    // Agregar un prefijo descriptivo si el título es genérico
    if (isGeneric) {
      console.log(`Título genérico detectado: "${cleanedTitle}". Agregando prefijo informativo.`);
      return `Artículo científico (título completo no disponible): ${cleanedTitle || 'Sin título'}`;
    }
    
    return cleanedTitle;
  }
  
  /**
   * Sanitiza texto general eliminando etiquetas HTML
   * @private
   * @param {string} text - Texto original
   * @returns {string} - Texto procesado
   */
  _sanitizeText(text) {
    if (!text) return '';
    
    // Eliminar etiquetas HTML y decodificar entidades HTML básicas
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }
  
  /**
   * Procesa y normaliza la estructura de autores
   * @private
   * @param {Array|Object|string} authorsData - Datos de autores en diferentes formatos
   * @returns {Array} - Lista normalizada de autores
   */
  _processAuthors(authorsData) {
    // Si no hay datos, devolver array vacío
    if (!authorsData) return [];
    
    // Si ya es un array
    if (Array.isArray(authorsData)) {
      return authorsData.map(author => {
        // Si es un objeto con name
        if (author && typeof author === 'object' && author.name) {
          return {
            name: this._sanitizeText(author.name),
            authtype: author.authtype || 'author'
          };
        }
        // Si es un string
        else if (typeof author === 'string') {
          return {
            name: this._sanitizeText(author),
            authtype: 'author'
          };
        }
        // Formato desconocido, intentar convertir a string
        return {
          name: author ? this._sanitizeText(String(author)) : 'Autor desconocido',
          authtype: 'author'
        };
      }).filter(author => author.name && author.name.trim() !== '');
    }
    
    // Si es un string (separado por comas)
    if (typeof authorsData === 'string') {
      return authorsData.split(',')
        .map(name => ({
          name: this._sanitizeText(name.trim()),
          authtype: 'author'
        }))
        .filter(author => author.name !== '');
    }
    
    // Si es un objeto individual
    if (typeof authorsData === 'object' && authorsData !== null && !Array.isArray(authorsData)) {
      // Si tiene un arreglo de autores dentro
      if (authorsData.authors && Array.isArray(authorsData.authors)) {
        return this._processAuthors(authorsData.authors);
      }
      
      // Si tiene un nombre directamente
      if (authorsData.name) {
        return [{
          name: this._sanitizeText(authorsData.name),
          authtype: authorsData.authtype || 'author'
        }];
      }
      
      // Intentar extraer claves que puedan contener nombres
      const possibleAuthors = [];
      for (const key in authorsData) {
        if (typeof authorsData[key] === 'string' && 
            (key.includes('name') || key.includes('autor') || key.includes('author'))) {
          possibleAuthors.push({
            name: this._sanitizeText(authorsData[key]),
            authtype: 'author'
          });
        }
      }
      
      if (possibleAuthors.length > 0) {
        return possibleAuthors.filter(author => author.name && author.name.trim() !== '');
      }
    }
    
    return [];
  }

  /**
   * Realiza una búsqueda básica en PubMed, retornando solo datos esenciales sin abstracts
   * @param {string} query - Consulta de búsqueda
   * @returns {Promise<Array>} - Lista de artículos con datos básicos
   */
  async searchBasic(query) {
    try {
      console.log(`Realizando búsqueda básica en PubMed: "${query.substring(0, 100)}..."`);
      
      // Construir URL para búsqueda básica (solo títulos y metadatos)
      const searchUrl = `${this.baseUrl}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=100`;
      
      // Realizar búsqueda inicial para obtener PMIDs
      const searchResponse = await axios.get(searchUrl);
      const pmids = searchResponse.data.esearchresult.idlist;
      
      if (!pmids || pmids.length === 0) {
        console.log('No se encontraron artículos');
        return [];
      }
      
      // Obtener detalles básicos de los artículos
      const fetchUrl = `${this.baseUrl}/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=xml`;
      const fetchResponse = await axios.get(fetchUrl);
      
      // Parsear XML y extraer datos básicos
      const articles = [];
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(fetchResponse.data, "text/xml");
      const articleNodes = xmlDoc.getElementsByTagName("PubmedArticle");
      
      for (let articleNode of articleNodes) {
        const pmid = articleNode.getElementsByTagName("PMID")[0]?.textContent;
        const title = articleNode.getElementsByTagName("ArticleTitle")[0]?.textContent;
        const journal = articleNode.getElementsByTagName("Journal")[0]?.getElementsByTagName("Title")[0]?.textContent;
        const pubDate = articleNode.getElementsByTagName("PubDate")[0];
        const year = pubDate?.getElementsByTagName("Year")[0]?.textContent;
        const month = pubDate?.getElementsByTagName("Month")[0]?.textContent;
        const day = pubDate?.getElementsByTagName("Day")[0]?.textContent;
        
        if (pmid && title) {
          articles.push({
            pmid,
            title,
            journal,
            publicationDate: year ? `${year}-${month || '01'}-${day || '01'}` : null,
            hasAbstract: false // Indicador de que no tenemos el abstract aún
          });
        }
      }
      
      console.log(`Se encontraron ${articles.length} artículos con datos básicos`);
      return articles;
    } catch (error) {
      console.error('Error en búsqueda básica de PubMed:', error);
      throw error;
    }
  }

  /**
   * Recupera abstracts para una lista de artículos
   * @param {Array} articles - Lista de artículos con PMIDs
   * @returns {Promise<Array>} - Lista de artículos con abstracts
   */
  async getAbstractsForArticles(articles) {
    try {
      if (!articles || articles.length === 0) {
        return [];
      }
      
      console.log(`Recuperando abstracts para ${articles.length} artículos`);
      
      // Procesar en lotes para respetar el rate limit
      const batchSize = 10;
      const delayBetweenBatches = 1000; // 1 segundo entre lotes
      const batches = [];
      
      for (let i = 0; i < articles.length; i += batchSize) {
        batches.push(articles.slice(i, i + batchSize));
      }
      
      const articlesWithAbstracts = [];
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const pmids = batch.map(article => article.pmid).join(',');
        
        try {
          const fetchUrl = `${this.baseUrl}/efetch.fcgi?db=pubmed&id=${pmids}&retmode=xml`;
          const response = await axios.get(fetchUrl);
          
          // Parsear XML y extraer abstracts
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(response.data, "text/xml");
          const articleNodes = xmlDoc.getElementsByTagName("PubmedArticle");
          
          for (let articleNode of articleNodes) {
            const pmid = articleNode.getElementsByTagName("PMID")[0]?.textContent;
            const abstractNode = articleNode.getElementsByTagName("Abstract")[0];
            const abstractText = abstractNode ? 
              Array.from(abstractNode.getElementsByTagName("AbstractText"))
                .map(node => node.textContent)
                .join(' ') : null;
            
            // Encontrar el artículo original y añadir el abstract
            const originalArticle = batch.find(a => a.pmid === pmid);
            if (originalArticle) {
              articlesWithAbstracts.push({
                ...originalArticle,
                abstract: abstractText,
                hasAbstract: true
              });
            }
          }
          
          // Esperar antes del siguiente lote para respetar rate limit
          if (i < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
          }
        } catch (batchError) {
          console.error(`Error al procesar lote ${i + 1}:`, batchError);
          // Añadir artículos sin abstract en caso de error
          articlesWithAbstracts.push(...batch.map(article => ({
            ...article,
            abstract: null,
            hasAbstract: false
          })));
        }
      }
      
      console.log(`Se recuperaron abstracts para ${articlesWithAbstracts.length} artículos`);
      return articlesWithAbstracts;
    } catch (error) {
      console.error('Error al recuperar abstracts:', error);
      throw error;
    }
  }
}

// Exportar una instancia del servicio
export default new PubMedService(); 