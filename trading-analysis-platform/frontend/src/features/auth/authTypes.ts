// Tipos del dominio de autenticacion (forma de la API del backend).

export interface AuthUser {
  id: number;
  nombreUsuario: string;
  email?: string | null;
  esAdmin: boolean;
  debeCambiarPassword: boolean;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  user: AuthUser;
}

export interface MeResponse extends AuthUser {
  activo: boolean;
}

export interface ValidateTokenResponse {
  valid: boolean;
  tipoToken?: string | null;
  email?: string | null; // enmascarado
}

export interface AdminUser {
  id: number;
  nombreUsuario: string;
  email?: string | null;
  activo: boolean;
  esAdmin: boolean;
  debeCambiarPassword: boolean;
  fechaCreacion?: string | null;
  ultimoAcceso?: string | null;
}

export interface AdminUserCreated extends AdminUser {
  setupEmailSent: boolean;
}
