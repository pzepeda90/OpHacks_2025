/**
 * Configuración centralizada para la aplicación
 * Carga variables de entorno y define configuraciones
 */
import 'dotenv/config';

const config = {
  // Servidor
  server: {
    port: process.env.PORT || 3001,
    env: process.env.NODE_ENV || 'development',
    apiPrefix: '/api'
  },
  
  // APIs externas
  apis: {
    pubmed: {
      baseUrl: process.env.PUBMED_API_URL || 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
      apiKey: process.env.PUBMED_API_KEY,
      maxResults: parseInt(process.env.PUBMED_MAX_RESULTS || '20', 10)
    },
    claude: {
      apiKey: process.env.CLAUDE_API_KEY,
      baseUrl: process.env.CLAUDE_API_URL || 'https://api.anthropic.com'
    },
    icite: {
      baseUrl: process.env.ICITE_API_URL || 'https://icite.od.nih.gov/api',
    }
  },
  
  // Límites y configuraciones de seguridad
  security: {
    rateLimit: {
      windowMs: 60 * 1000, // 1 minuto
      max: 100 // Máximo 100 peticiones por minuto
    },
    corsOptions: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    }
  },
  
  // Configuración de caché
  cache: {
    enabled: process.env.CACHE_ENABLED === 'true',
    ttl: parseInt(process.env.CACHE_TTL || '3600', 10) // En segundos
  },
  
  // Configuración de logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined'
  }
};

// Validaciones básicas
if (config.apis.pubmed.apiKey === undefined) {
  console.warn('⚠️  PUBMED_API_KEY no está definido en variables de entorno');
}

if (config.apis.claude.apiKey === undefined) {
  console.warn('⚠️  CLAUDE_API_KEY no está definido en variables de entorno');
}

export default config; 