import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./styles/theme.css";
import "./styles/buttons.css";

import "./styles/global.css";
import "./styles/login.css";
import "./styles/layout.css";
import "./styles/dashboard.css";
import "./styles/userManagement.css";
import "./styles/module.css";
import "./styles/vendor.css";
import "./styles/pos.css";
import "./styles/settings.css";

import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);