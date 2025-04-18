import React from "react";
import "./Footer.css";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          <div className="footer-section">
            <h3 className="footer-title">Evident-IA</h3>
            <p className="footer-description">
              Una plataforma basada en IA para consultas médicas científicas.
            </p>
          </div>
          
          <div className="footer-section">
            <h3 className="footer-title">Enlaces</h3>
            <ul className="footer-links">
              <li><a href="#">Términos y condiciones</a></li>
              <li><a href="#">Política de privacidad</a></li>
              <li><a href="#">Contacto</a></li>
            </ul>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>&copy; {currentYear} Evident-IA. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 