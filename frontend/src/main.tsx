import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { InterviewProvider } from "./context/InterviewContext";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <InterviewProvider>
        <App />
      </InterviewProvider>
    </BrowserRouter>
  </React.StrictMode>
);
