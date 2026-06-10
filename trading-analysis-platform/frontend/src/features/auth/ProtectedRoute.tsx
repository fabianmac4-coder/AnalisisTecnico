import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "./authStore";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Exige sesion iniciada; si no, redirige a /login.
 * Si el usuario tiene cambio de contraseña forzado (debeCambiarPassword),
 * solo puede ver /change-password: cualquier otra ruta protegida redirige ahi.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const initializing = useAuthStore((s) => s.initializing);
  const mustChangePassword = useAuthStore((s) => Boolean(s.user?.debeCambiarPassword));
  const location = useLocation();

  if (initializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0d1017]">
        <Spinner size={28} />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  return <>{children}</>;
}

/** Exige sesion + permisos de administrador. */
export function AdminRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  return (
    <ProtectedRoute>
      {user?.esAdmin ? <>{children}</> : <Navigate to="/" replace />}
    </ProtectedRoute>
  );
}
