import { useState } from "react";
import { Link } from "react-router-dom";
import { authService } from "@/features/auth/authService";
import { useAuthStore } from "@/features/auth/authStore";
import { ChangePasswordForm } from "./ChangePasswordForm";

/**
 * Mi Cuenta (/account): disponible para TODO usuario autenticado.
 * Perfil propio (nombre/email editables) + cambio de contraseña.
 * Aqui NUNCA se ven otros usuarios; eso vive en /admin/users (solo admins).
 */
export function MyAccountPage() {
  const user = useAuthStore((s) => s.user);
  const applyUserPatch = useAuthStore((s) => s.applyUserPatch);

  const [nombre, setNombre] = useState(user?.nombreUsuario ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  if (!user) return null;

  const profileDirty =
    nombre.trim() !== user.nombreUsuario || email.trim() !== (user.email ?? "");

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    setSavingProfile(true);
    try {
      const me = await authService.updateMe({
        nombreUsuario: nombre.trim(),
        email: email.trim(),
      });
      applyUserPatch({ nombreUsuario: me.nombreUsuario, email: me.email });
      setProfileSuccess("Perfil actualizado");
    } catch (err) {
      setProfileError((err as Error).message || "No se pudo actualizar el perfil");
    } finally {
      setSavingProfile(false);
    }
  };

  const inputClass =
    "mt-1 w-full rounded border border-edge bg-panel-2 px-3 py-2 text-sm text-gray-100 focus:border-accent focus:outline-none";

  return (
    <div className="min-h-screen bg-[#0d1017] p-6 text-gray-100">
      <div className="mx-auto max-w-xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">Mi cuenta</h1>
          <Link
            to="/"
            className="rounded border border-edge bg-panel-2 px-3 py-1.5 text-sm text-gray-200 hover:bg-panel-3"
          >
            ← Volver a las gráficas
          </Link>
        </div>

        {/* Perfil */}
        <section className="mb-5 rounded-lg border border-edge bg-panel p-5">
          <h2 className="mb-1 text-sm font-bold text-gray-100">Perfil</h2>
          <p className="mb-4 text-[11px] text-muted">
            Rol: <span className="text-gray-200">{user.esAdmin ? "Administrador" : "Usuario"}</span>
            {" · "}Estado: <span className="text-up">Activo</span>
          </p>
          <form onSubmit={saveProfile}>
            <label className="mb-3 block text-xs text-muted">
              Nombre de usuario
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="mb-3 block text-xs text-muted">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </label>
            {profileError && (
              <p className="mb-3 rounded bg-red-500/10 px-2 py-1.5 text-xs text-down">
                {profileError}
              </p>
            )}
            {profileSuccess && (
              <p className="mb-3 rounded bg-green-500/10 px-2 py-1.5 text-xs text-up">
                {profileSuccess}
              </p>
            )}
            <button
              type="submit"
              disabled={savingProfile || !profileDirty || !nombre.trim() || !email.trim()}
              className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {savingProfile ? "Guardando…" : "Guardar perfil"}
            </button>
          </form>
        </section>

        {/* Cambio de contraseña */}
        <section className="rounded-lg border border-edge bg-panel p-5">
          <h2 className="mb-4 text-sm font-bold text-gray-100">Cambiar contraseña</h2>
          <ChangePasswordForm />
        </section>
      </div>
    </div>
  );
}
