import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";

// DANGER: local testing only. Lets you click through the app before Microsoft
// sign-in is configured. Must never be set in any deployed environment.
const DEV_BYPASS_AUTH = import.meta.env.VITE_DEV_BYPASS_AUTH === "true";
if (DEV_BYPASS_AUTH) {
  // eslint-disable-next-line no-console
  console.warn("AUTH IS DISABLED (VITE_DEV_BYPASS_AUTH=true) — every route is unlocked.");
}

// TEMPORARY: Microsoft login is paused in every environment, including production,
// per explicit decision on 2026-08-07 — the Azure app registration isn't set up yet.
// Flip back to false once Microsoft sign-in is ready to re-enable the login gate.
const AUTH_PAUSED = true;
if (AUTH_PAUSED) {
  // eslint-disable-next-line no-console
  console.warn("AUTH IS PAUSED (AUTH_PAUSED) — Microsoft login is temporarily disabled.");
}

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { session, loading } = useAuth();

  if (DEV_BYPASS_AUTH || AUTH_PAUSED) {
    return <>{children}</>;
  }

  if (loading) {
    return null;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
