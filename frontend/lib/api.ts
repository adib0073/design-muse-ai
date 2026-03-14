export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const API_KEY = process.env.NEXT_PUBLIC_BACKEND_API_KEY || "";

export function apiHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (API_KEY) {
    headers["X-API-Key"] = API_KEY;
  }
  return headers;
}

export function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const merged: RequestInit = { ...init };
  const existing =
    init?.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : ((init?.headers as Record<string, string>) ?? {});

  merged.headers = apiHeaders(existing);
  return fetch(`${API_URL}${path}`, merged);
}
