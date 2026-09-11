const API = `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/auth`;

export async function register(data) {
  return fetch(`${API}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });
}

export async function login(data) {
  return fetch(`${API}/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });
}