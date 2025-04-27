import React from "react";
import "./Card.css";

/**
 * Componente que SOLO muestra el análisis secundario de un artículo, con estilos.
 * @param {Object} props
 * @param {Object} props.article - Objeto del artículo (debe tener secondaryAnalysis)
 */
function unescapeHtml(html) {
  // Convierte entidades HTML escapadas a HTML real
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
}

const SoloAnalisisSecundario = ({ article }) => {
  if (!article || !article.secondaryAnalysis) {
    return <div className="secondary-analysis">No hay análisis secundario disponible.</div>;
  }

  let html = article.secondaryAnalysis;
  // Si viene escapado (&lt;div...), lo desescapamos
  if (typeof html === "string" && html.includes("&lt;")) {
    html = unescapeHtml(html);
  }

  // Si no tiene la clase card-analysis, lo envolvemos
  if (typeof html === "string" && !html.includes("card-analysis")) {
    html = `<div class="card-analysis"><div class="card-section">${html}</div></div>`;
  }

  return (
    <div className="secondary-analysis">
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
};

export default SoloAnalisisSecundario; 