// Llamadas de autenticacion al backend (siempre via apiClient).

import { apiClient } from "@/services/apiClient";
import type {
  AdminUser,
  AdminUserCreated,
  LoginResponse,
  MeResponse,
  ValidateTokenResponse,
} from "./authTypes";

export const authService = {
  login(username: string, password: string): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>("/auth/login", { username, password });
  },

  me(): Promise<MeResponse> {
    return apiClient.get<MeResponse>("/auth/me");
  },

  /** Edita SOLO el perfil propio (nombre/email); nunca esAdmin/activo. */
  updateMe(changes: Partial<{ nombreUsuario: string; email: string }>): Promise<MeResponse> {
    return apiClient.patch<MeResponse>("/auth/me", changes);
  },

  logout(): Promise<{ success: boolean }> {
    return apiClient.post("/auth/logout");
  },

  validatePasswordToken(token: string): Promise<ValidateTokenResponse> {
    const q = new URLSearchParams({ token });
    return apiClient.get(`/auth/validate-password-token?${q.toString()}`);
  },

  setPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return apiClient.post("/auth/set-password", { token, newPassword });
  },

  resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    return apiClient.post("/auth/reset-password", { token, newPassword });
  },

  forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    return apiClient.post("/auth/forgot-password", { email });
  },

  changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    return apiClient.post("/auth/change-password", { currentPassword, newPassword });
  },

  // ===== Admin =====
  listUsers(): Promise<AdminUser[]> {
    return apiClient.get("/admin/users");
  },

  createUser(data: {
    nombreUsuario: string;
    email: string;
    esAdmin: boolean;
  }): Promise<AdminUserCreated> {
    return apiClient.post("/admin/users", data);
  },

  updateUser(
    id: number,
    changes: Partial<{ nombreUsuario: string; email: string; esAdmin: boolean; activo: boolean }>
  ): Promise<AdminUser> {
    return apiClient.patch(`/admin/users/${id}`, changes);
  },

  sendPasswordReset(id: number): Promise<{ success: boolean; resetEmailSent: boolean }> {
    return apiClient.post(`/admin/users/${id}/send-password-reset`);
  },

  deactivateUser(id: number): Promise<AdminUser> {
    return apiClient.delete(`/admin/users/${id}`);
  },

  /** Borrado PERMANENTE (usuario + todos sus registros). Irreversible. */
  hardDeleteUser(id: number): Promise<{ success: boolean; message: string }> {
    return apiClient.delete(`/admin/users/${id}/hard-delete`);
  },

  setTemporaryPassword(
    id: number,
    temporaryPassword: string,
    requireChange = true
  ): Promise<{ success: boolean; message: string }> {
    return apiClient.post(`/admin/users/${id}/set-temporary-password`, {
      temporaryPassword,
      requireChange,
    });
  },

  forcePasswordChange(id: number): Promise<{ success: boolean; message: string }> {
    return apiClient.post(`/admin/users/${id}/force-password-change`);
  },
};
