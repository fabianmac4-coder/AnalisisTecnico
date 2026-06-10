// @vitest-environment jsdom
// Tests de autenticacion frontend: guards, token en requests, set-password.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProtectedRoute, AdminRoute } from "./ProtectedRoute";
import { LoginPage } from "./LoginPage";
import { SetPasswordPage } from "./SetPasswordPage";
import { useAuthStore } from "./authStore";
import { getAuthToken, setAuthToken } from "./authToken";
import { apiClient } from "@/services/apiClient";

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    initializing: false,
    loginError: null,
    loggingIn: false,
  });
  vi.restoreAllMocks();
});
afterEach(() => cleanup());

function renderWithRoutes(initialPath: string, element: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>PAGINA LOGIN</div>} />
        <Route path="/" element={element} />
        <Route path="/app" element={element} />
        <Route path="/set-password" element={<SetPasswordPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("guards de rutas", () => {
  it("sin sesion redirige a /login", () => {
    renderWithRoutes("/app", <ProtectedRoute><div>APP PRIVADA</div></ProtectedRoute>);
    expect(screen.getByText("PAGINA LOGIN")).toBeTruthy();
    expect(screen.queryByText("APP PRIVADA")).toBeNull();
  });

  it("con sesion muestra el contenido protegido", () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 1, nombreUsuario: "Ana", esAdmin: false, debeCambiarPassword: false },
    });
    renderWithRoutes("/app", <ProtectedRoute><div>APP PRIVADA</div></ProtectedRoute>);
    expect(screen.getByText("APP PRIVADA")).toBeTruthy();
  });

  it("AdminRoute bloquea a usuarios sin esAdmin", () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 1, nombreUsuario: "Ana", esAdmin: false, debeCambiarPassword: false },
    });
    renderWithRoutes(
      "/app",
      <AdminRoute><div>SOLO ADMIN</div></AdminRoute>
    );
    expect(screen.queryByText("SOLO ADMIN")).toBeNull();
  });

  it("AdminRoute permite a admins", () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: { id: 1, nombreUsuario: "Root", esAdmin: true, debeCambiarPassword: false },
    });
    renderWithRoutes("/app", <AdminRoute><div>SOLO ADMIN</div></AdminRoute>);
    expect(screen.getByText("SOLO ADMIN")).toBeTruthy();
  });
});

describe("token en requests", () => {
  it("apiClient adjunta Authorization: Bearer cuando hay token", async () => {
    setAuthToken("mi-token-jwt");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }) as never
    );
    await apiClient.get("/catalog");
    const headers = (fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer mi-token-jwt");
  });

  it("un 401 en ruta protegida limpia el token", async () => {
    setAuthToken("token-expirado");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "expirado" }), { status: 401 }) as never
    );
    await expect(apiClient.get("/catalog")).rejects.toThrow();
    expect(getAuthToken()).toBeNull();
  });

  it("un 401 del LOGIN no limpia nada (password incorrecta)", async () => {
    setAuthToken(null);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Credenciales inválidas" }), {
        status: 401,
      }) as never
    );
    const ok = await useAuthStore.getState().login("user", "mala");
    expect(ok).toBe(false);
    expect(useAuthStore.getState().loginError).toContain("Credenciales");
  });
});

describe("login page", () => {
  it("login correcto guarda token y usuario", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: "jwt-nuevo",
          tokenType: "bearer",
          user: { id: 1, nombreUsuario: "Ana", esAdmin: false, debeCambiarPassword: false },
        }),
        { status: 200 }
      ) as never
    );
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>DASHBOARD</div>} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText(/Usuario o email/i), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), { target: { value: "Clave123" } });
    fireEvent.click(screen.getByRole("button", { name: /Iniciar sesión/i }));
    await waitFor(() => expect(screen.getByText("DASHBOARD")).toBeTruthy());
    expect(getAuthToken()).toBe("jwt-nuevo");
    expect(useAuthStore.getState().user?.nombreUsuario).toBe("Ana");
  });
});

describe("set-password page", () => {
  it("lee el token del query string, valida y exige confirmacion igual", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ valid: true, tipoToken: "SET_PASSWORD", email: "a***@x.com" }),
        { status: 200 }
      ) as never
    );
    renderWithRoutes("/set-password?token=abc123", <div />);
    await waitFor(() => expect(screen.getByText(/a\*\*\*@x.com/)).toBeTruthy());
    // valido el token con el query correcto
    expect(String(fetchSpy.mock.calls[0][0])).toContain("token=abc123");

    fireEvent.change(screen.getByLabelText(/Nueva contraseña/i), {
      target: { value: "Clave1234" },
    });
    fireEvent.change(screen.getByLabelText(/Confirmar contraseña/i), {
      target: { value: "Distinta1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Guardar contraseña/i }));
    await waitFor(() =>
      expect(screen.getByText(/Las contraseñas no coinciden/)).toBeTruthy()
    );
  });

  it("token invalido muestra error claro", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ valid: false }), { status: 200 }) as never
    );
    renderWithRoutes("/set-password?token=viejo", <div />);
    await waitFor(() =>
      expect(screen.getByText(/inválido o expiró/)).toBeTruthy()
    );
  });
});
