async function apiRequest(url, options = {}) {
  const config = {
    method: options.method || "GET",
    headers: {},
    ...options
  };

  if (options.body !== undefined) {
    config.headers["Content-Type"] = "application/json";
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, config);
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const error = new Error(data?.message || "Request failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export function getHealth() {
  return apiRequest("/api/health");
}

export function getCurrentUser() {
  return apiRequest("/api/me");
}

export function login(credentials) {
  return apiRequest("/api/login", {
    method: "POST",
    body: credentials
  });
}

export function logout() {
  return apiRequest("/api/logout", {
    method: "POST"
  });
}

export function getDirectories() {
  return apiRequest("/api/directories");
}

export function createDirectory(payload) {
  return apiRequest("/api/directories", {
    method: "POST",
    body: payload
  });
}

export function deleteDirectory(id) {
  return apiRequest(`/api/directories/${id}`, {
    method: "DELETE"
  });
}
