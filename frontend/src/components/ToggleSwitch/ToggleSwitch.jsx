import React from "react";
import "./ToggleSwitch.css";

const ToggleSwitch = ({ checked, onChange, id, label }) => {
  return (
    <div className="toggle-switch">
      <input
        className="toggle-switch-checkbox"
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label className="toggle-switch-label" htmlFor={id}>
        <span className="toggle-switch-inner"></span>
        <span className="toggle-switch-switch"></span>
      </label>
      {label && <span className="toggle-switch-text">{label}</span>}
    </div>
  );
};

export default ToggleSwitch; 