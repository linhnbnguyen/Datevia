import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from './firebase';
import "leaflet/dist/leaflet.css";
import App from "./App.tsx";
import "./index.css";

// Validate connection to Firestore as per requirements
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection verified.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    } else {
      console.warn("Firestore connection check produced an expected error/result:", error);
    }
  }
}
testConnection();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);