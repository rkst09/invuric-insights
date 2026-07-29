import { useState } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const Login = () => {
  const { session, loading, authError, signInWithMicrosoft } = useAuth();
  const [status, setStatus] = useState<"idle" | "redirecting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  if (!loading && session) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = async () => {
    setStatus("redirecting");
    setErrorMessage("");
    const { error } = await signInWithMicrosoft();
    if (error) {
      setStatus("error");
      setErrorMessage(error);
    }
  };

  const displayedError = status === "error" ? errorMessage : authError;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card/80 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.18)] backdrop-blur">
        <p className="font-mono-label text-[11px] tracking-[0.24em] text-primary">INVURIC</p>
        <h1 className="mt-3 text-xl font-semibold text-foreground">Sign in</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Sign in with your company Microsoft account. Only approved company domains can access this workspace.
        </p>

        <div className="mt-6 space-y-3">
          <Button
            type="button"
            className="w-full"
            onClick={handleSignIn}
            disabled={status === "redirecting"}
          >
            {status === "redirecting" ? "Redirecting to Microsoft…" : "Sign in with Microsoft"}
          </Button>
          {displayedError && (
            <p className="text-sm text-destructive">{displayedError}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
