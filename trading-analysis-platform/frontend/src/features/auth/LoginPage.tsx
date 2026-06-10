import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "./authStore";

/** Pagina de inicio de sesion (usuario o email + contrasena). */
export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const loginError = useAuthStore((s) => s.loginError);
  const loggingIn = useAuthStore((s) => s.loggingIn);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await login(username.trim(), password);
    if (ok) navigate("/", { replace: true });
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[#0d1017]">
      <form
        onSubmit={submit}
        className="w-80 rounded-lg border border-edge bg-panel p-6 shadow-lg"
      >
        <div className="mb-5 flex items-center gap-2">
          <span className="text-xl">📊</span>
          <h1 className="text-base font-bold text-gray-100">Análisis Técnico</h1>
        </div>

        <label className="mb-3 block text-xs text-muted">
          Usuario o email
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            className="mt-1 w-full rounded border border-edge bg-panel-2 px-3 py-2 text-sm text-gray-100 focus:border-accent focus:outline-none"
          />
        </label>

        <label className="mb-4 block text-xs text-muted">
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="mt-1 w-full rounded border border-edge bg-panel-2 px-3 py-2 text-sm text-gray-100 focus:border-accent focus:outline-none"
          />
        </label>

        {loginError && (
          <p className="mb-3 rounded bg-red-500/10 px-2 py-1.5 text-xs text-down">{loginError}</p>
        )}

        <button
          type="submit"
          disabled={loggingIn || !username.trim() || !password}
          className="w-full rounded bg-accent py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {loggingIn ? "Entrando…" : "Iniciar sesión"}
        </button>

        <Link
          to="/forgot-password"
          className="mt-3 block text-center text-[11px] text-accent hover:underline"
        >
          ¿Olvidaste tu contraseña?
        </Link>

        <p className="mt-4 text-center text-[11px] text-muted">
          Las cuentas las crea un administrador. Si recibiste un correo, usa el
          enlace para definir tu contraseña.
        </p>
      </form>
    </div>
  );
}
