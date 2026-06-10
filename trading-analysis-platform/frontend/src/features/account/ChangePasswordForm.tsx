import { useState } from "react";
import { authService } from "@/features/auth/authService";
import { useAuthStore } from "@/features/auth/authStore";

/**
 * Formulario de cambio de contraseña del usuario autenticado
 * (POST /auth/change-password). Reutilizado por Mi Cuenta y /change-password.
 */
export function ChangePasswordForm({ onChanged }: { onChanged?: () => void }) {
  const applyUserPatch = useAuthStore((s) => s.applyUserPatch);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (next !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setSaving(true);
    try {
      await authService.changePassword(current, next);
      // El backend pone DebeCambiarPassword=0: reflejarlo en sesion.
      applyUserPatch({ debeCambiarPassword: false });
      setSuccess("Contraseña actualizada correctamente");
      setCurrent("");
      setNext("");
      setConfirm("");
      onChanged?.();
    } catch (err) {
      setError((err as Error).message || "No se pudo cambiar la contraseña");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "mt-1 w-full rounded border border-edge bg-panel-2 px-3 py-2 text-sm text-gray-100 focus:border-accent focus:outline-none";

  return (
    <form onSubmit={submit} data-testid="change-password-form">
      <label className="mb-3 block text-xs text-muted">
        Contraseña actual
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          className={inputClass}
        />
      </label>
      <label className="mb-3 block text-xs text-muted">
        Nueva contraseña
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          className={inputClass}
        />
      </label>
      <label className="mb-3 block text-xs text-muted">
        Confirmar nueva contraseña
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          className={inputClass}
        />
      </label>
      <p className="mb-3 text-[11px] text-muted">
        Mínimo 8 caracteres, con al menos una letra y un número.
      </p>
      {error && (
        <p className="mb-3 rounded bg-red-500/10 px-2 py-1.5 text-xs text-down">{error}</p>
      )}
      {success && (
        <p className="mb-3 rounded bg-green-500/10 px-2 py-1.5 text-xs text-up">{success}</p>
      )}
      <button
        type="submit"
        disabled={saving || !current || !next || !confirm}
        className="w-full rounded bg-accent py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {saving ? "Guardando…" : "Cambiar contraseña"}
      </button>
    </form>
  );
}
