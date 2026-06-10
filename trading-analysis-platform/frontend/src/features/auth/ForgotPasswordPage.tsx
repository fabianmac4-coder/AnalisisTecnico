import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/services/apiClient";
import { authService } from "./authService";

/**
 * Pagina /forgot-password: pide el email y dispara el correo de
 * restablecimiento. Validación explícita (sistema interno): el backend
 * responde 404 si el email no existe y 403 si el usuario está inactivo.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await authService.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError("No existe un usuario activo con ese email.");
      } else if (err instanceof ApiError && err.status === 403) {
        setError("Este usuario está inactivo. Contacta al administrador.");
      } else {
        setError((err as Error).message || "No se pudo enviar el correo de recuperación.");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[#0d1017]">
      <div className="w-80 rounded-lg border border-edge bg-panel p-6 shadow-lg">
        <h1 className="mb-2 text-base font-bold text-gray-100">¿Olvidaste tu contraseña?</h1>
        <p className="mb-4 text-xs text-muted">
          Escribe el email de tu cuenta y te enviaremos un enlace para definir
          una nueva contraseña. El enlace expira en 1 hora.
        </p>

        {sent ? (
          <div>
            <p className="rounded bg-green-500/10 px-3 py-2 text-sm text-up">
              Correo de recuperación enviado. Revisa tu bandeja de entrada.
            </p>
            <Link
              to="/login"
              className="mt-4 block w-full rounded border border-edge bg-panel-2 py-2 text-center text-sm text-gray-200 hover:bg-panel-3"
            >
              Volver al login
            </Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label className="mb-4 block text-xs text-muted">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                className="mt-1 w-full rounded border border-edge bg-panel-2 px-3 py-2 text-sm text-gray-100 focus:border-accent focus:outline-none"
              />
            </label>

            {error && (
              <p className="mb-3 rounded bg-red-500/10 px-2 py-1.5 text-xs text-down">{error}</p>
            )}

            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="w-full rounded bg-accent py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {sending ? "Enviando…" : "Enviar enlace de recuperación"}
            </button>

            <Link
              to="/login"
              className="mt-3 block text-center text-[11px] text-muted hover:text-gray-200"
            >
              ← Volver al login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
