import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authService } from "./authService";
import { useAuthStore } from "./authStore";
import type { AdminUser } from "./authTypes";

/**
 * Administracion de usuarios (/admin/users, solo admins).
 * Crear usuario NO pide contraseña: el usuario la define via link de correo.
 * Nunca se muestra PasswordHash.
 * Dos acciones de baja MUY distintas: Desactivar (reversible, conserva datos)
 * y Eliminar definitivamente (borra hijos + usuario; requiere teclear DELETE).
 */
export function AdminUsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [hardDeleting, setHardDeleting] = useState<AdminUser | null>(null);
  const [tempPasswordFor, setTempPasswordFor] = useState<AdminUser | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await authService.listUsers());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const onSendReset = async (user: AdminUser) => {
    if (!window.confirm(`¿Enviar correo de restablecimiento a ${user.nombreUsuario}?`)) return;
    try {
      const res = await authService.sendPasswordReset(user.id);
      setNotice(
        res.resetEmailSent
          ? `Correo enviado a ${user.email}`
          : "SMTP no configurado: el enlace se registró en la consola del backend"
      );
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onForceChange = async (user: AdminUser) => {
    if (
      !window.confirm(
        `¿Obligar a ${user.nombreUsuario} a cambiar su contraseña en su siguiente inicio de sesión?`
      )
    )
      return;
    try {
      await authService.forcePasswordChange(user.id);
      setNotice(`${user.nombreUsuario} deberá cambiar su contraseña al iniciar sesión`);
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onToggleActive = async (user: AdminUser) => {
    const verb = user.activo ? "desactivar" : "activar";
    if (!window.confirm(`¿Seguro que quieres ${verb} a ${user.nombreUsuario}?`)) return;
    try {
      if (user.activo) await authService.deactivateUser(user.id);
      else await authService.updateUser(user.id, { activo: true });
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1017] p-6 text-gray-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">Administración de usuarios</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreate(true)}
              className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
            >
              + Crear usuario
            </button>
            <Link
              to="/"
              className="rounded border border-edge bg-panel-2 px-3 py-1.5 text-sm text-gray-200 hover:bg-panel-3"
            >
              ← Volver
            </Link>
          </div>
        </div>

        {error && (
          <p className="mb-3 rounded bg-red-500/10 px-3 py-2 text-sm text-down">{error}</p>
        )}
        {notice && (
          <p className="mb-3 rounded bg-blue-500/10 px-3 py-2 text-sm text-accent">{notice}</p>
        )}

        <div className="overflow-x-auto rounded-lg border border-edge bg-panel">
          <table className="w-full text-left text-xs">
            <thead className="bg-panel-2 text-muted">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Usuario</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Activo</th>
                <th className="px-3 py-2">Admin</th>
                <th className="px-3 py-2">Password pendiente</th>
                <th className="px-3 py-2">Último acceso</th>
                <th className="px-3 py-2">Creado</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-4 text-center text-muted">
                    Cargando…
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-t border-edge">
                    <td className="px-3 py-2 text-muted">{u.id}</td>
                    <td className="px-3 py-2 font-medium">{u.nombreUsuario}</td>
                    <td className="px-3 py-2 text-muted">{u.email}</td>
                    <td className="px-3 py-2">{u.activo ? "✓" : "✗"}</td>
                    <td className="px-3 py-2">{u.esAdmin ? "✓" : ""}</td>
                    <td className="px-3 py-2">{u.debeCambiarPassword ? "Sí" : ""}</td>
                    <td className="px-3 py-2 text-muted">
                      {u.ultimoAcceso ? u.ultimoAcceso.slice(0, 16).replace("T", " ") : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {u.fechaCreacion ? u.fechaCreacion.slice(0, 10) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setEditing(u)}
                          className="rounded bg-panel-3 px-2 py-0.5 hover:bg-edge"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => void onSendReset(u)}
                          title="Enviar correo de restablecimiento de contraseña"
                          className="rounded bg-panel-3 px-2 py-0.5 hover:bg-edge"
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => void onToggleActive(u)}
                          className="rounded bg-panel-3 px-2 py-0.5 hover:bg-red-500/20"
                        >
                          {u.activo ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          onClick={() => setTempPasswordFor(u)}
                          title="Asignar una contraseña temporal"
                          data-testid={`temp-password-${u.id}`}
                          className="rounded bg-panel-3 px-2 py-0.5 hover:bg-edge"
                        >
                          Clave temp.
                        </button>
                        <button
                          onClick={() => void onForceChange(u)}
                          title="Obligar a cambiar la contraseña en el siguiente login"
                          className="rounded bg-panel-3 px-2 py-0.5 hover:bg-edge"
                        >
                          Forzar cambio
                        </button>
                        {currentUser?.id !== u.id && (
                          <button
                            onClick={() => setHardDeleting(u)}
                            data-testid={`hard-delete-${u.id}`}
                            title="Eliminar permanentemente (no se puede deshacer)"
                            className="rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-red-400 hover:bg-red-500/25"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={(msg) => {
            setNotice(msg);
            setShowCreate(false);
            void reload();
          }}
        />
      )}
      {editing && (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
      {hardDeleting && (
        <HardDeleteModal
          user={hardDeleting}
          onClose={() => setHardDeleting(null)}
          onDeleted={() => {
            setUsers((prev) => prev.filter((u) => u.id !== hardDeleting.id));
            setHardDeleting(null);
            setNotice("Usuario eliminado permanentemente");
          }}
        />
      )}
      {tempPasswordFor && (
        <TempPasswordModal
          user={tempPasswordFor}
          onClose={() => setTempPasswordFor(null)}
          onSaved={() => {
            setTempPasswordFor(null);
            setNotice(
              `Contraseña temporal asignada a ${tempPasswordFor.nombreUsuario}. Comunícasela en persona; nunca por correo.`
            );
            void reload();
          }}
        />
      )}
    </div>
  );
}

function HardDeleteModal({
  user,
  onClose,
  onDeleted,
}: {
  user: AdminUser;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const canConfirm = confirmText === "DELETE";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canConfirm) return;
    setDeleting(true);
    setError(null);
    try {
      await authService.hardDeleteUser(user.id);
      onDeleted();
    } catch (err) {
      setError((err as Error).message);
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={submit}
        className="w-[26rem] rounded-lg border border-red-500/40 bg-panel p-5"
      >
        <h2 className="mb-2 text-sm font-bold text-red-400">
          ¿Eliminar usuario permanentemente?
        </h2>
        <p className="mb-3 text-xs text-gray-300">
          Esto eliminará para siempre a <strong>{user.nombreUsuario}</strong> y
          todos sus registros relacionados: dibujos, indicadores, layouts,
          catálogo y tokens de contraseña. <strong>Esta acción no se puede
          deshacer.</strong>
        </p>
        <label className="mb-3 block text-xs text-muted">
          Para confirmar, escribe <span className="font-mono font-bold text-red-400">DELETE</span>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoFocus
            data-testid="hard-delete-confirm-input"
            className="mt-1 w-full rounded border border-edge bg-panel-2 px-3 py-2 font-mono text-sm text-gray-100 focus:border-red-500 focus:outline-none"
          />
        </label>
        {error && (
          <p className="mb-3 rounded bg-red-500/10 px-2 py-1.5 text-xs text-down">{error}</p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-edge bg-panel-2 px-3 py-1.5 text-xs text-gray-200 hover:bg-panel-3"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!canConfirm || deleting}
            data-testid="hard-delete-confirm-button"
            className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-40"
          >
            {deleting ? "Eliminando…" : "Eliminar definitivamente"}
          </button>
        </div>
      </form>
    </div>
  );
}

function TempPasswordModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [requireChange, setRequireChange] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setSaving(true);
    try {
      await authService.setTemporaryPassword(user.id, password, requireChange);
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  const inputClass =
    "mt-1 w-full rounded border border-edge bg-panel-2 px-3 py-2 font-mono text-sm text-gray-100 focus:border-accent focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form onSubmit={submit} className="w-96 rounded-lg border border-edge bg-panel p-5">
        <h2 className="mb-2 text-sm font-bold text-gray-100">
          Contraseña temporal para {user.nombreUsuario}
        </h2>
        <p className="mb-3 text-[11px] text-muted">
          No se envía por correo: comunícasela directamente al usuario.
        </p>
        <label className="mb-3 block text-xs text-muted">
          Nueva contraseña temporal
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            data-testid="temp-password-input"
            className={inputClass}
          />
        </label>
        <label className="mb-3 block text-xs text-muted">
          Confirmar contraseña temporal
          <input
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            data-testid="temp-password-confirm"
            className={inputClass}
          />
        </label>
        <label className="mb-3 flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={requireChange}
            onChange={(e) => setRequireChange(e.target.checked)}
            data-testid="temp-password-require-change"
          />
          Exigir cambio de contraseña en el siguiente inicio de sesión
        </label>
        <p className="mb-3 text-[11px] text-muted">
          Mínimo 8 caracteres, con al menos una letra y un número.
        </p>
        {error && (
          <p className="mb-3 rounded bg-red-500/10 px-2 py-1.5 text-xs text-down">{error}</p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-edge bg-panel-2 px-3 py-1.5 text-xs text-gray-200 hover:bg-panel-3"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || password.length < 8 || !confirm}
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Asignar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (notice: string) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [esAdmin, setEsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await authService.createUser({
        nombreUsuario: nombre.trim(),
        email: email.trim(),
        esAdmin,
      });
      onCreated(
        res.setupEmailSent
          ? `Usuario creado. Correo de configuración enviado a ${res.email}.`
          : "Usuario creado. SMTP no configurado: el enlace se registró en la consola del backend."
      );
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form onSubmit={submit} className="w-96 rounded-lg border border-edge bg-panel p-5">
        <h2 className="mb-3 text-sm font-bold text-gray-100">Crear usuario</h2>
        <label className="mb-3 block text-xs text-muted">
          Nombre de usuario
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoFocus
            className="mt-1 w-full rounded border border-edge bg-panel-2 px-3 py-2 text-sm text-gray-100 focus:border-accent focus:outline-none"
          />
        </label>
        <label className="mb-3 block text-xs text-muted">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-edge bg-panel-2 px-3 py-2 text-sm text-gray-100 focus:border-accent focus:outline-none"
          />
        </label>
        <label className="mb-3 flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={esAdmin} onChange={(e) => setEsAdmin(e.target.checked)} />
          Administrador
        </label>
        <p className="mb-3 text-[11px] text-muted">
          El usuario recibirá un correo para definir su contraseña.
        </p>
        {error && (
          <p className="mb-3 rounded bg-red-500/10 px-2 py-1.5 text-xs text-down">{error}</p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-edge bg-panel-2 px-3 py-1.5 text-xs text-gray-200 hover:bg-panel-3"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !nombre.trim() || !email.trim()}
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {saving ? "Creando…" : "Crear"}
          </button>
        </div>
      </form>
    </div>
  );
}

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState(user.nombreUsuario);
  const [email, setEmail] = useState(user.email ?? "");
  const [esAdmin, setEsAdmin] = useState(user.esAdmin);
  const [activo, setActivo] = useState(user.activo);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await authService.updateUser(user.id, {
        nombreUsuario: nombre.trim(),
        email: email.trim(),
        esAdmin,
        activo,
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form onSubmit={submit} className="w-96 rounded-lg border border-edge bg-panel p-5">
        <h2 className="mb-3 text-sm font-bold text-gray-100">Editar usuario #{user.id}</h2>
        <label className="mb-3 block text-xs text-muted">
          Nombre de usuario
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="mt-1 w-full rounded border border-edge bg-panel-2 px-3 py-2 text-sm text-gray-100 focus:border-accent focus:outline-none"
          />
        </label>
        <label className="mb-3 block text-xs text-muted">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-edge bg-panel-2 px-3 py-2 text-sm text-gray-100 focus:border-accent focus:outline-none"
          />
        </label>
        <div className="mb-3 flex gap-4">
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={esAdmin}
              onChange={(e) => setEsAdmin(e.target.checked)}
            />
            Administrador
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
            />
            Activo
          </label>
        </div>
        {error && (
          <p className="mb-3 rounded bg-red-500/10 px-2 py-1.5 text-xs text-down">{error}</p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-edge bg-panel-2 px-3 py-1.5 text-xs text-gray-200 hover:bg-panel-3"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
