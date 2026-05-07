import React, { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Navigate, Route, Routes } from "react-router-dom";
import api from "./api";
import LoginPanel from "./components/LoginPanel";
import Toast from "./components/Toast";
import UserDashboard from "./components/UserDashboard";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,_#08131f_0%,_#0f1d2d_100%)] text-white">
      <div className="text-center">
        <div className="mx-auto h-14 w-14 animate-pulse rounded-3xl border border-cyan-300/30 bg-cyan-300/10" />
        <p className="mt-4 text-sm text-slate-300">Restoring your FactoryFlow session...</p>
      </div>
    </div>
  );
}

function defaultPathForUser(user) {
  if (!user) return "/login";
  return "/portal/customer";
}

function ProtectedRoute({ user, allowedRole, children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={defaultPathForUser(user)} replace />;
  }

  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const { data } = await api.get("/auth/me");
        if (active) {
          setUser(data.user);
        }
      } catch {
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  const addToast = (message, type = "success") => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  };

  const handleAuthenticated = (nextUser) => {
    setUser(nextUser);
    addToast(`Signed in as ${nextUser.role}.`, "success");
  };

  const handleSessionExpired = () => {
    setUser(null);
    addToast("Your session expired. Please sign in again.", "error");
  };

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Keep the local logout behavior even if the request fails.
    } finally {
      setUser(null);
      addToast("You have been signed out.", "info");
    }
  };

  if (checkingSession) {
    return <LoadingScreen />;
  }

  const defaultPath = defaultPathForUser(user);

  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to={defaultPath} replace />
            ) : (
              <LoginPanel onAuthenticated={handleAuthenticated} onToast={addToast} />
            )
          }
        />

        <Route
          path="/portal/customer"
          element={
            <ProtectedRoute user={user}>
              <UserDashboard
                user={user}
                onLogout={handleLogout}
                onSessionExpired={handleSessionExpired}
                onToast={addToast}
              />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to={defaultPath} replace />} />
        <Route path="*" element={<Navigate to={defaultPath} replace />} />
      </Routes>

      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <Toast key={toast.id} message={toast.message} type={toast.type} />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
