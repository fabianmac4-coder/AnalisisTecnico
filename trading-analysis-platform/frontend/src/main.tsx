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
import { NewsPage } from "./features/news/NewsPage";
import { MarketMoversPage } from "./features/marketMovers/MarketMoversPage";
import { MarketIntelligencePage } from "./features/marketIntelligence/MarketIntelligencePage";
import { MacroPage } from "./features/macro/MacroPage";
import { PortfolioPage } from "./features/portfolio/PortfolioPage";
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
              path="/news"
              element={
                <ProtectedRoute>
                  <NewsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/market-movers"
              element={
                <ProtectedRoute>
                  <MarketMoversPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/market-intelligence"
              element={
                <ProtectedRoute>
                  <MarketIntelligencePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/macro"
              element={
                <ProtectedRoute>
                  <MacroPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/portfolio"
              element={
                <ProtectedRoute>
                  <PortfolioPage />
                </ProtectedRoute>
              }
            />
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
