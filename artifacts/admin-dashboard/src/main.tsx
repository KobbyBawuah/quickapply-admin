import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setupAuthFetch } from "./lib/auth";

setupAuthFetch();

createRoot(document.getElementById("root")!).render(<App />);
