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

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { session, loading } = useAuth();

  if (DEV_BYPASS_AUTH) {
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
