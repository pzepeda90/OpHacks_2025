import React from "react";
import "./SearchBar.css";

const SearchBar = ({ value, onChange, onSubmit }) => {
  return (
    <form className="search-bar" onSubmit={onSubmit}>
      <div className="search-input-container">
        <input
          type="text"
          id="search-input"
          className="search-input"
          placeholder="Ej: ¿Cuáles son los síntomas de la neumonía?"
          value={value}
          onChange={onChange}
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