import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/features/auth/authStore";
import { ChangePasswordForm } from "./ChangePasswordForm";

/**
 * /change-password: cambio FORZADO de contraseña. ProtectedRoute manda aqui a
 * cualquier usuario con debeCambiarPassword=1 y bloquea el resto de rutas
 * hasta que la cambie. Tras el cambio se libera y se va al dashboard.
 */
export function ChangePasswordPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const onChanged = () => {
    setTimeout(() => navigate("/", { replace: true }), 900);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d1017] p-4">
      <div className="w-96 rounded-lg border border-edge bg-panel p-6 shadow-lg">
        <h1 className="mb-2 text-base font-bold text-gray-100">Cambia tu contraseña</h1>
        <p className="mb-4 rounded bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Debes cambiar tu contraseña temporal antes de continuar.
        </p>
        <ChangePasswordForm onChanged={onChanged} />
        <button
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
          className="mt-3 w-full rounded border border-edge bg-panel-2 py-2 text-xs text-muted hover:bg-panel-3"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
