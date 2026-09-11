import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

import Login from "./pages/Login";
import Register from "./pages/Register";
import AppLayout from "./components/AppLayout";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {

  const [authenticated, setAuthenticated] = useState(null);
  const [username, setUsername] = useState("");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch(`${API}/auth/me`, {
        credentials: "include"
      });

      if (res.ok) {
        const data = await res.json();
        setUsername(data.user || "");
        setAuthenticated(true);
      } else {
        setAuthenticated(false);
      }

    } catch {
      setAuthenticated(false);
    }
  };

  if (authenticated === null) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#020203", color: "#a1a1aa" }}>
        Loading...
      </div>
    );
  }

  return (
    <BrowserRouter>

      <Routes>

        <Route
          path="/login"
          element={
            authenticated
              ? <Navigate to="/" />
              : <Login onLogin={checkAuth} />
          }
        />

        <Route
          path="/register"
          element={
            authenticated
              ? <Navigate to="/" />
              : <Register />
          }
        />

        <Route
          path="/"
          element={
            authenticated
              ? <AppLayout onLogout={() => setAuthenticated(false)} username={username} authenticated={authenticated} />
              : <Navigate to="/login" />
          }
        />

      </Routes>

    </BrowserRouter>
  );
}