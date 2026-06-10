// @vitest-environment jsdom
// Tests de Mi Cuenta, cambio forzado de contraseña y navegacion por rol.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MyAccountPage } from "./MyAccountPage";
import { ChangePasswordPage } from "./ChangePasswordPage";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { AdminUsersPage } from "@/features/auth/AdminUsersPage";
import { useAuthStore } from "@/features/auth/authStore";
import type { AuthUser } from "@/features/auth/authTypes";

const regularUser: AuthUser = {
  id: 7,
  nombreUsuario: "Carla",
  email: "carla@example.com",
  esAdmin: false,
  debeCambiarPassword: false,
};

function setSession(user: AuthUser) {
  useAuthStore.setState({
    user,
    isAuthenticated: true,
    initializing: false,
    loginError: null,
    loggingIn: false,
  });
}

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

describe("Mi Cuenta (/account)", () => {
  it("renderiza el perfil de un usuario normal (sin lista de usuarios)", () => {
    setSession(regularUser);
    render(
      <MemoryRouter initialEntries={["/account"]}>
        <Routes>
          <Route path="/account" element={<MyAccountPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Mi cuenta")).toBeTruthy();
    expect(screen.getByDisplayValue("Carla")).toBeTruthy();
    expect(screen.getByDisplayValue("carla@example.com")).toBeTruthy();
    expect(screen.getByText("Usuario")).toBeTruthy(); // rol
    expect(screen.getByTestId("change-password-form")).toBeTruthy();
  });

  it("el cambio de contraseña llama a /auth/change-password", async () => {
    setSession(regularUser);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, message: "ok" }) as never
    );
    render(
      <MemoryRouter initialEntries={["/account"]}>
        <Routes>
          <Route path="/account" element={<MyAccountPage />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText(/Contraseña actual/i), {
      target: { value: "Vieja1234" },
    });
    fireEvent.change(screen.getByLabelText(/^Nueva contraseña$/i), {
      target: { value: "Nueva1234" },
    });
    fireEvent.change(screen.getByLabelText(/Confirmar nueva contraseña/i), {
      target: { value: "Nueva1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Cambiar contraseña/i }));
    await waitFor(() =>
      expect(screen.getByText("Contraseña actualizada correctamente")).toBeTruthy()
    );
    const call = fetchSpy.mock.calls.find((c) =>
      String(c[0]).includes("/auth/change-password")
    );
    expect(call).toBeTruthy();
    expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({
      currentPassword: "Vieja1234",
      newPassword: "Nueva1234",
    });
  });

  it("exige que la confirmación coincida sin llamar al backend", async () => {
    setSession(regularUser);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(
      <MemoryRouter initialEntries={["/account"]}>
        <Routes>
          <Route path="/account" element={<MyAccountPage />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText(/Contraseña actual/i), {
      target: { value: "Vieja1234" },
    });
    fireEvent.change(screen.getByLabelText(/^Nueva contraseña$/i), {
      target: { value: "Nueva1234" },
    });
    fireEvent.change(screen.getByLabelText(/Confirmar nueva contraseña/i), {
      target: { value: "Distinta1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Cambiar contraseña/i }));
    await waitFor(() =>
      expect(screen.getByText("Las contraseñas no coinciden")).toBeTruthy()
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("cambio forzado (debeCambiarPassword)", () => {
  it("usuario con flag es redirigido de cualquier ruta protegida a /change-password", () => {
    setSession({ ...regularUser, debeCambiarPassword: true });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/change-password"
            element={<div>PAGINA CAMBIO FORZADO</div>}
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>DASHBOARD</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("PAGINA CAMBIO FORZADO")).toBeTruthy();
    expect(screen.queryByText("DASHBOARD")).toBeNull();
  });

  it("tras cambiar la contraseña el usuario entra al dashboard", async () => {
    setSession({ ...regularUser, debeCambiarPassword: true });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, message: "ok" }) as never
    );
    render(
      <MemoryRouter initialEntries={["/change-password"]}>
        <Routes>
          <Route
            path="/change-password"
            element={
              <ProtectedRoute>
                <ChangePasswordPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>DASHBOARD</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/Debes cambiar tu contraseña temporal/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Contraseña actual/i), {
      target: { value: "Temporal123" },
    });
    fireEvent.change(screen.getByLabelText(/^Nueva contraseña$/i), {
      target: { value: "Definitiva1" },
    });
    fireEvent.change(screen.getByLabelText(/Confirmar nueva contraseña/i), {
      target: { value: "Definitiva1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Cambiar contraseña/i }));
    // El store limpia el flag y la pagina redirige al dashboard.
    await waitFor(
      () => expect(screen.getByText("DASHBOARD")).toBeTruthy(),
      { timeout: 3000 }
    );
    expect(useAuthStore.getState().user?.debeCambiarPassword).toBe(false);
  });
});

describe("navegacion por rol (Header)", () => {
  it("usuario normal ve Mi cuenta pero NO Administración de usuarios", async () => {
    const { Header } = await import("@/components/layout/Header");
    setSession(regularUser);
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );
    expect(screen.getByTestId("account-link")).toBeTruthy();
    expect(screen.getByTestId("account-link").getAttribute("href")).toBe("/account");
    expect(screen.queryByTestId("admin-link")).toBeNull();
  });

  it("admin ve Mi cuenta Y Administración de usuarios", async () => {
    const { Header } = await import("@/components/layout/Header");
    setSession({ ...regularUser, esAdmin: true });
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );
    expect(screen.getByTestId("account-link")).toBeTruthy();
    expect(screen.getByTestId("admin-link").getAttribute("href")).toBe("/admin/users");
  });
});

describe("admin: clave temporal", () => {
  const adminUser: AuthUser = {
    id: 1,
    nombreUsuario: "Root",
    esAdmin: true,
    debeCambiarPassword: false,
  };
  const usersList = [
    {
      id: 1,
      nombreUsuario: "Root",
      email: "root@x.com",
      activo: true,
      esAdmin: true,
      debeCambiarPassword: false,
    },
    {
      id: 2,
      nombreUsuario: "Carla",
      email: "carla@x.com",
      activo: true,
      esAdmin: false,
      debeCambiarPassword: false,
    },
  ];

  it("la accion Clave temp. abre modal con confirmación y checkbox de cambio forzado", async () => {
    setSession(adminUser);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      if (init?.method === "POST") {
        return Promise.resolve(
          jsonResponse({ success: true, message: "Temporary password set successfully" }) as never
        );
      }
      return Promise.resolve(jsonResponse(usersList) as never);
    });
    render(
      <MemoryRouter initialEntries={["/admin/users"]}>
        <Routes>
          <Route path="/admin/users" element={<AdminUsersPage />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("Carla")).toBeTruthy());

    // Acciones presentes: Reset (correo) y Clave temp.
    expect(screen.getAllByText("Reset").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId("temp-password-2"));

    const checkbox = screen.getByTestId("temp-password-require-change") as HTMLInputElement;
    expect(checkbox.checked).toBe(true); // default: exigir cambio

    fireEvent.change(screen.getByTestId("temp-password-input"), {
      target: { value: "Temporal123" },
    });
    fireEvent.change(screen.getByTestId("temp-password-confirm"), {
      target: { value: "Temporal123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Asignar$/i }));

    await waitFor(() => {
      const call = fetchSpy.mock.calls.find((c) =>
        String(c[0]).includes("/admin/users/2/set-temporary-password")
      );
      expect(call).toBeTruthy();
      expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({
        temporaryPassword: "Temporal123",
        requireChange: true,
      });
    });
  });
});
