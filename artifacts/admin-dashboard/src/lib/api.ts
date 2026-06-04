/// <reference types="vite/client" />

export const PRODUCTION_API_URL =
  "https://workspaceapi-server-production-31fb.up.railway.app";

const TOKEN_KEY = "qap_admin_token";

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function getApiBaseUrl(): string {
  const configuredBase = String(import.meta.env.VITE_API_URL || "").trim();

  if (configuredBase) {
    return normalizeBaseUrl(configuredBase);
  }

  if (import.meta.env.DEV) {
    return "http://localhost:5000";
  }

  return PRODUCTION_API_URL;
}

export function getAdminToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  if (cleanPath.startsWith("/api/")) {
    return `${base}${cleanPath}`;
  }

  return `${base}/api${cleanPath}`;
}

type ApiCallOptions = RequestInit & {
  auth?: boolean;
};

export async function apiCall<T = any>(
  path: string,
  options: ApiCallOptions = {}
): Promise<T> {
  const { auth = true, headers, ...requestOptions } = options;

  const token = getAdminToken();
  const url = buildApiUrl(path);

  let response: Response;

  try {
    response = await fetch(url, {
      ...requestOptions,
      mode: "cors",
      credentials: "omit",
      headers: {
        Accept: "application/json",
        ...(requestOptions.body ? { "Content-Type": "application/json" } : {}),
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers || {}),
      },
    });
  } catch (err: any) {
    throw new Error(
      `Failed to connect to API server. API: ${getApiBaseUrl()}. ${
        err?.message || ""
      }`
    );
  }

  const rawText = await response.text();

  let data: any = {};

  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = {
      error: rawText || `Request failed with status ${response.status}`,
    };
  }

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
    }

    throw new Error(
      data?.error ||
        data?.message ||
        data?.details ||
        `Request failed with status ${response.status}`
    );
  }

  return data as T;
}

export async function apiGet<T = any>(path: string): Promise<T> {
  return apiCall<T>(path, {
    method: "GET",
  });
}

export async function apiPost<T = any>(
  path: string,
  body?: unknown
): Promise<T> {
  return apiCall<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function apiPut<T = any>(
  path: string,
  body?: unknown
): Promise<T> {
  return apiCall<T>(path, {
    method: "PUT",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function apiDelete<T = any>(path: string): Promise<T> {
  return apiCall<T>(path, {
    method: "DELETE",
  });
}