import React from "react";
import "./SearchBar.css";

const SearchBar = ({ value, onChange, onSubmit }) => {
  return (
    <form className="search-bar" onSubmit={onSubmit}>
      <div className="search-input-container">
        <textarea
          id="search-input"
          className="search-input"
          placeholder="Ej: ¿Cuáles son los tratamientos más efectivos para la hipertensión arterial en pacientes mayores de 65 años con diabetes tipo 2?"
          value={value}
          onChange={onChange}
          rows="2"
          required
        />
        <button type="submit" className="search-button">
          <span className="search-icon">🔍</span>
          <span className="search-button-text">Buscar</span>
        </button>
      </div>
    </form>
  );
};

export default SearchBar; 