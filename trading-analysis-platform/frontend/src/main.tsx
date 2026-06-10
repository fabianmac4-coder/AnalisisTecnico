import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { App } from "./app/App";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { LoginPage } from "./features/auth/LoginPage";
import { SetPasswordPage } from "./features/auth/SetPasswordPage";
import { ForgotPasswordPage } from "./features/auth/ForgotPasswordPage";
import { AdminRoute, ProtectedRoute } from "./features/auth/ProtectedRoute";
import { AdminUsersPage } from "./features/auth/AdminUsersPage";
import { MyAccountPage } from "./features/account/MyAccountPage";
import { ChangePasswordPage } from "./features/account/ChangePasswordPage";
import { useAuthStore } from "./features/auth/authStore";
import "./index.css";

/** Revalida el token persistido contra /auth/me una vez al arrancar. */
function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const loadMe = useAuthStore((s) => s.loadMe);
  useEffect(() => {
    void loadMe();
  }, [loadMe]);
  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary variant="app">
      <BrowserRouter>
        <AuthBootstrap>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/set-password" element={<SetPasswordPage />} />
            <Route path="/reset-password" element={<SetPasswordPage mode="reset" />} />
            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <MyAccountPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/change-password"
              element={
                <ProtectedRoute>
                  <ChangePasswordPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <AdminUsersPage />
                </AdminRoute>
              }
            />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <App />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthBootstrap>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
