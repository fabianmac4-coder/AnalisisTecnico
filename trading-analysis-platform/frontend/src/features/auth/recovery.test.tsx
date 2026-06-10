// @vitest-environment jsdom
// Tests de recuperacion de contraseña y borrado permanente (admin).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LoginPage } from "./LoginPage";
import { ForgotPasswordPage } from "./ForgotPasswordPage";
import { SetPasswordPage } from "./SetPasswordPage";
import { AdminUsersPage } from "./AdminUsersPage";
import { useAuthStore } from "./authStore";

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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("forgot password", () => {
  it("el login muestra el enlace ¿Olvidaste tu contraseña? hacia /forgot-password", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );
    const link = screen.getByText("¿Olvidaste tu contraseña?");
    expect(link.getAttribute("href")).toBe("/forgot-password");
  });

  it("envía el email a /auth/forgot-password y muestra éxito", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, message: "Password recovery email sent." }) as never
    );
    render(
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: "ana@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Enviar enlace/i }));
    await waitFor(() =>
      expect(screen.getByText(/Correo de recuperación enviado/)).toBeTruthy()
    );
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/auth/forgot-password");
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ email: "ana@example.com" });
  });

  it("404 muestra 'No existe un usuario activo con ese email.'", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ detail: "No active user exists with that email." }, 404) as never
    );
    render(
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: "nadie@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Enviar enlace/i }));
    await waitFor(() =>
      expect(screen.getByText("No existe un usuario activo con ese email.")).toBeTruthy()
    );
  });

  it("403 muestra el mensaje de usuario inactivo", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ detail: "This user is inactive." }, 403) as never
    );
    render(
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: "inactivo@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Enviar enlace/i }));
    await waitFor(() =>
      expect(screen.getByText(/usuario está inactivo/)).toBeTruthy()
    );
  });
});

describe("reset password page (/reset-password)", () => {
  function renderResetPage(token = "tok-reset") {
    return render(
      <MemoryRouter initialEntries={[`/reset-password?token=${token}`]}>
        <Routes>
          <Route path="/reset-password" element={<SetPasswordPage mode="reset" />} />
          <Route path="/login" element={<div>PAGINA LOGIN</div>} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("valida el token de la URL y actualiza la contraseña via /auth/reset-password", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      const u = String(url);
      if (u.includes("/auth/validate-password-token")) {
        return Promise.resolve(
          jsonResponse({ valid: true, tipoToken: "RESET_PASSWORD", email: "a***@x.com" }) as never
        );
      }
      return Promise.resolve(
        jsonResponse({ success: true, message: "Password updated successfully." }) as never
      );
    });
    renderResetPage();
    await waitFor(() => expect(screen.getByText(/a\*\*\*@x.com/)).toBeTruthy());
    expect(String(fetchSpy.mock.calls[0][0])).toContain("token=tok-reset");

    fireEvent.change(screen.getByLabelText(/Nueva contraseña/i), {
      target: { value: "Nueva1234" },
    });
    fireEvent.change(screen.getByLabelText(/Confirmar contraseña/i), {
      target: { value: "Nueva1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Guardar contraseña/i }));
    await waitFor(() =>
      expect(screen.getByText(/Contraseña actualizada. Inicia sesión/)).toBeTruthy()
    );
    const resetCall = fetchSpy.mock.calls.find((c) =>
      String(c[0]).includes("/auth/reset-password")
    );
    expect(resetCall).toBeTruthy();
    expect(JSON.parse((resetCall![1] as RequestInit).body as string)).toEqual({
      token: "tok-reset",
      newPassword: "Nueva1234",
    });
  });

  it("token inválido muestra el error de enlace expirado", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ valid: false, reason: "invalid_or_expired" }) as never
    );
    renderResetPage("viejo");
    await waitFor(() => expect(screen.getByText(/inválido o expiró/)).toBeTruthy());
  });
});

describe("admin: eliminar permanentemente", () => {
  const rootUser = { id: 1, nombreUsuario: "Root", esAdmin: true, debeCambiarPassword: false };
  const usersList = [
    {
      id: 1,
      nombreUsuario: "Root",
      email: "root@x.com",
      activo: true,
      esAdmin: true,
      debeCambiarPassword: false,
      fechaCreacion: "2026-01-01T00:00:00",
      ultimoAcceso: null,
    },
    {
      id: 2,
      nombreUsuario: "Fake",
      email: "fake@x.com",
      activo: true,
      esAdmin: false,
      debeCambiarPassword: false,
      fechaCreacion: "2026-01-02T00:00:00",
      ultimoAcceso: null,
    },
  ];

  function renderAdmin() {
    useAuthStore.setState({ isAuthenticated: true, user: rootUser });
    return render(
      <MemoryRouter initialEntries={["/admin/users"]}>
        <Routes>
          <Route path="/admin/users" element={<AdminUsersPage />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("muestra Eliminar para otros usuarios pero NO para el usuario actual", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(usersList) as never);
    renderAdmin();
    await waitFor(() => expect(screen.getByText("Fake")).toBeTruthy());
    expect(screen.getByTestId("hard-delete-2")).toBeTruthy();
    expect(screen.queryByTestId("hard-delete-1")).toBeNull();
  });

  it("exige teclear DELETE para habilitar la confirmación y elimina de la tabla", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      if (init?.method === "DELETE") {
        return Promise.resolve(
          jsonResponse({ success: true, message: "User permanently deleted" }) as never
        );
      }
      return Promise.resolve(jsonResponse(usersList) as never);
    });
    renderAdmin();
    await waitFor(() => expect(screen.getByText("Fake")).toBeTruthy());

    fireEvent.click(screen.getByTestId("hard-delete-2"));
    expect(screen.getByText("¿Eliminar usuario permanentemente?")).toBeTruthy();

    const confirmButton = screen.getByTestId("hard-delete-confirm-button");
    expect((confirmButton as HTMLButtonElement).disabled).toBe(true);

    // Texto equivocado: sigue deshabilitado.
    fireEvent.change(screen.getByTestId("hard-delete-confirm-input"), {
      target: { value: "delete" },
    });
    expect((confirmButton as HTMLButtonElement).disabled).toBe(true);

    // DELETE exacto: habilita y ejecuta.
    fireEvent.change(screen.getByTestId("hard-delete-confirm-input"), {
      target: { value: "DELETE" },
    });
    expect((confirmButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(screen.getByText("Usuario eliminado permanentemente")).toBeTruthy()
    );
    expect(screen.queryByText("Fake")).toBeNull(); // fuera de la tabla
    const deleteCall = fetchSpy.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === "DELETE"
    );
    expect(String(deleteCall![0])).toContain("/admin/users/2/hard-delete");
  });
});
