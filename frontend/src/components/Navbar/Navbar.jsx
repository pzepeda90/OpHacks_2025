import React from "react";
import "./Navbar.css";

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <h1>Evident-IA</h1>
          <span className="logo-subtitle">Asistente Médico Inteligente</span>
        </div>
        <div className="navbar-links">
          <a href="#" className="navbar-link">Inicio</a>
          <a href="#" className="navbar-link">Sobre Nosotros</a>
          <a href="#" className="navbar-link">Contacto</a>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 