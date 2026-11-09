import { Capacitor } from "@capacitor/core";
import React from "react";
import { createRoot } from "react-dom/client";
import { setupIonicReact } from "@ionic/react";
import "@ionic/react/css/core.css";
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";
import "./ui/styles.css";
import { App } from "./ui/App";
setupIonicReact({ mode: "md" });
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Cache only bundled assets; personal data stays in IndexedDB. Android ships its assets.
if (
  import.meta.env.PROD &&
  !Capacitor.isNativePlatform() &&
  "serviceWorker" in navigator
) {
  void navigator.serviceWorker.register("/sw.js").catch(console.error);
}
