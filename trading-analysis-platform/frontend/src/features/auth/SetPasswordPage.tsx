import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authService } from "./authService";

type TokenState = "checking" | "valid" | "invalid";

/**
 * Pagina /set-password (alta de cuenta) y /reset-password (clave olvidada).
 * Misma mecanica: valida el token del link de correo y define la contrasena.
 */
export function SetPasswordPage({ mode = "set" }: { mode?: "set" | "reset" }) {
  const isReset = mode === "reset";
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";

  const [tokenState, setTokenState] = useState<TokenState>("checking");
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenState("invalid");
      return;
    }
    authService
      .validatePasswordToken(token)
      .then((res) => {
        setTokenState(res.valid ? "valid" : "invalid");
        setMaskedEmail(res.email ?? null);
      })
      .catch(() => setTokenState("invalid"));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setSaving(true);
    try {
      if (isReset) await authService.resetPassword(token, password);
      else await authService.setPassword(token, password);
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 1800);
    } catch (err) {
      setError((err as Error).message || "No se pudo guardar la contraseña");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[#0d1017]">
      <div className="w-96 rounded-lg border border-edge bg-panel p-6 shadow-lg">
        <h1 className="mb-4 text-base font-bold text-gray-100">
          {isReset ? "Restablecer contraseña" : "Definir contraseña"}
        </h1>

        {tokenState === "checking" && <p className="text-sm text-muted">Validando enlace…</p>}

        {tokenState === "invalid" && (
          <div>
            <p className="rounded bg-red-500/10 px-3 py-2 text-sm text-down">
              {isReset
                ? "El enlace de restablecimiento es inválido o expiró. Solicítalo de nuevo desde «¿Olvidaste tu contraseña?»."
                : "El enlace es inválido o expiró. Pide a un administrador que envíe uno nuevo."}
            </p>
            <button
              onClick={() => navigate("/login")}
              className="mt-4 w-full rounded border border-edge bg-panel-2 py-2 text-sm text-gray-200 hover:bg-panel-3"
            >
              Ir al login
            </button>
          </div>
        )}

        {tokenState === "valid" && done && (
          <p className="rounded bg-green-500/10 px-3 py-2 text-sm text-up">
            {isReset
              ? "Contraseña actualizada. Inicia sesión…"
              : "Contraseña guardada. Redirigiendo al login…"}
          </p>
        )}

        {tokenState === "valid" && !done && (
          <form onSubmit={submit}>
            {maskedEmail && (
              <p className="mb-3 text-xs text-muted">Cuenta: {maskedEmail}</p>
            )}
            <label className="mb-3 block text-xs text-muted">
              Nueva contraseña
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
                className="mt-1 w-full rounded border border-edge bg-panel-2 px-3 py-2 text-sm text-gray-100 focus:border-accent focus:outline-none"
              />
            </label>
            <label className="mb-4 block text-xs text-muted">
              Confirmar contraseña
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                className="mt-1 w-full rounded border border-edge bg-panel-2 px-3 py-2 text-sm text-gray-100 focus:border-accent focus:outline-none"
              />
            </label>
            <p className="mb-3 text-[11px] text-muted">
              Mínimo 8 caracteres, con al menos una letra y un número.
            </p>
            {error && (
              <p className="mb-3 rounded bg-red-500/10 px-2 py-1.5 text-xs text-down">{error}</p>
            )}
            <button
              type="submit"
              disabled={saving || !password || !confirm}
              className="w-full rounded bg-accent py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
