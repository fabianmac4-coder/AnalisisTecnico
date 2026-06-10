// Almacenamiento del JWT (modulo separado para evitar ciclos de import entre
// apiClient y authStore). MVP: localStorage; mas adelante, cookies httpOnly.

const TOKEN_KEY = "tap.auth.token.v1";

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token === null) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage inaccesible */
  }
}
