// Estado global de autenticacion. El token vive en localStorage (authToken.ts)
// y el usuario se revalida con /auth/me al cargar la app.

import { create } from "zustand";
import { authService } from "./authService";
import { getAuthToken, setAuthToken } from "./authToken";
import type { AuthUser } from "./authTypes";

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** true mientras se revalida el token persistido al arrancar. */
  initializing: boolean;
  loginError: string | null;
  loggingIn: boolean;

  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  /** Revalida el token persistido contra /auth/me (al montar la app). */
  loadMe: () => Promise<void>;
  setPassword: (token: string, newPassword: string) => Promise<void>;
  /** Actualiza el usuario en memoria (tras editar perfil o cambiar clave). */
  applyUserPatch: (changes: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  initializing: Boolean(getAuthToken()),
  loginError: null,
  loggingIn: false,

  async login(username, password) {
    set({ loggingIn: true, loginError: null });
    try {
      const res = await authService.login(username, password);
      setAuthToken(res.accessToken);
      set({ user: res.user, isAuthenticated: true, loggingIn: false });
      return true;
    } catch (err) {
      set({
        loginError: (err as Error).message || "Error de autenticación",
        loggingIn: false,
        isAuthenticated: false,
        user: null,
      });
      return false;
    }
  },

  logout() {
    void authService.logout().catch(() => undefined);
    setAuthToken(null);
    set({ user: null, isAuthenticated: false });
  },

  async loadMe() {
    if (!getAuthToken()) {
      set({ initializing: false, isAuthenticated: false, user: null });
      return;
    }
    try {
      const me = await authService.me();
      set({
        user: {
          id: me.id,
          nombreUsuario: me.nombreUsuario,
          email: me.email,
          esAdmin: me.esAdmin,
          debeCambiarPassword: me.debeCambiarPassword,
        },
        isAuthenticated: true,
        initializing: false,
      });
    } catch {
      setAuthToken(null);
      set({ user: null, isAuthenticated: false, initializing: false });
    }
  },

  async setPassword(token, newPassword) {
    await authService.setPassword(token, newPassword);
  },

  applyUserPatch(changes) {
    set((state) => ({
      user: state.user ? { ...state.user, ...changes } : state.user,
    }));
  },
}));
