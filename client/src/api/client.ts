import type { ApiErrorBody } from '@api-types';

/** Empty in development: Vite proxies `/api` to the local API. Baked in at build time. */
export const API_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

/** A production build without VITE_API_URL would call the static host and fail confusingly. */
export const API_CONFIG_ERROR =
  import.meta.env.PROD && !API_URL
    ? 'VITE_API_URL is not set for this build, so the app does not know where the API is.'
    : undefined;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** 4xx means the request itself is wrong; retrying will not help. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (API_CONFIG_ERROR) throw new ApiError(0, API_CONFIG_ERROR);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the API. Check your connection or try again in a moment.');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    const detail = Array.isArray(body?.message) ? body.message.join('; ') : body?.message;
    throw new ApiError(response.status, detail || `The API responded with ${response.status}.`);
  }
  return (await response.json()) as T;
}

/** Fire-and-forget: starts waking a sleeping free-tier API as early as possible. */
export function wakeApi(): void {
  if (!API_CONFIG_ERROR) fetch(`${API_URL}/api/health`).catch(() => undefined);
}
