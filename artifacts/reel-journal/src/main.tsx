import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl) setBaseUrl(apiUrl);

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!publishableKey) throw new Error("VITE_CLERK_PUBLISHABLE_KEY is not set");

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={publishableKey}>
    <App />
  </ClerkProvider>
);
