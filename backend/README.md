# Backend de Consultas Científicas con IA

Este backend implementa un sistema de consultas científicas médicas que utiliza IA (Claude Haiku) para optimizar búsquedas en PubMed y analizar resultados.

## Características

- Validación de preguntas científicas usando IA
- Procesamiento de preguntas con metodología PICO
- Traducción de consultas al inglés
- Generación de estrategias de búsqueda optimizadas para PubMed
- Análisis y puntuación de resultados científicos
- API RESTful con endpoints documentados

## Instalación

```bash
# Clonar el repositorio
git clone <repositorio>

# Navegar al directorio
cd backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus claves API
```

## Variables de Entorno

Crea un archivo `.env` con las siguientes variables:

```
PORT=3000
CLAUDE_API_KEY=tu_clave_api_claude
PUBMED_API_KEY=tu_clave_api_pubmed
```

## Ejecutar el Servidor

### Desarrollo
```bash
npm run dev
```

### Producción
```bash
npm start
```

## API Endpoints

### Procesar Consulta Científica
- **URL**: `/api/scientific-query`
- **Método**: `POST`
- **Body**:
  ```json
  {
    "question": "¿Es efectiva la metformina para prevenir la diabetes tipo 2 en pacientes con prediabetes?",
    "useAI": true
  }
  ```
- **Respuesta Exitosa**:
  ```json
  {
    "message": "Consulta procesada exitosamente",
    "results": [
      {
        "pmid": "12345678",
        "doi": "10.xxxx/xxxxx",
        "title": "Título del artículo",
        "authors": [{"name": "Autor 1", "authtype": "Author"}],
        "publicationDate": "2022 Jan",
        "abstract": "Resumen del artículo...",
        "meshTerms": ["Metformin", "Diabetes Type 2", "Prevention"],
        "relevanceScore": 5,
        "analysisExplanation": "Explicación del análisis..."
      }
    ],
    "originalQuestion": "¿Es efectiva la metformina para prevenir la diabetes tipo 2 en pacientes con prediabetes?",
    "processedQuestion": {
      "pico": {
        "population": "Pacientes con prediabetes",
        "intervention": "Metformina",
        "comparator": "Placebo o no tratamiento",
        "outcome": "Prevención de diabetes tipo 2"
      },
      "translatedQuestion": "Is metformin effective for preventing type 2 diabetes in patients with prediabetes?",
      "searchStrategy": "metformin[MeSH Terms] AND prediabetes[MeSH Terms] AND prevention[MeSH Terms] AND diabetes type 2[MeSH Terms]"
    },
    "totalResults": 1
  }
  ```

## Estructura del Proyecto

```
backend/
├── config/            # Configuración de la aplicación
├── controllers/       # Controladores de la API
├── middlewares/       # Middlewares personalizados
├── routes/            # Definición de rutas
├── utils/             # Utilidades y servicios
├── .env               # Variables de entorno (no incluido en repositorio)
├── index.js           # Punto de entrada de la aplicación
└── package.json       # Dependencias y scripts
```
