import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import "@fontsource-variable/manrope";
import "@fontsource-variable/jetbrains-mono";
import { router } from "./app/router";
import { ErrorBoundary } from "./components/system/ErrorBoundary";
import { NotificationProvider } from "./components/system/NotificationCenter";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <NotificationProvider>
        <RouterProvider router={router} />
      </NotificationProvider>
    </ErrorBoundary>
  </StrictMode>,
);
