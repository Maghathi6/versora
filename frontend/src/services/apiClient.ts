import { healthService } from './healthService';
import { authStorage } from '../utils/authStorage';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

type UnauthorizedCallback = () => void;
const unauthorizedListeners: Set<UnauthorizedCallback> = new Set();

/**
 * Registers a listener to be notified when an authenticated API call receives a 401 Unauthorized response.
 * Returns an unsubscription function.
 */
export function onUnauthorized(callback: UnauthorizedCallback): () => void {
  unauthorizedListeners.add(callback);
  return () => {
    unauthorizedListeners.delete(callback);
  };
}

function notifyUnauthorized(): void {
  unauthorizedListeners.forEach((callback) => {
    try {
      callback();
    } catch {
      // Ignore listener errors
    }
  });
}

/**
 * Standard Application Error for API communication failures.
 */
export class ApiError extends Error {
  public code?: string;
  public details?: unknown;
  public status?: number;

  constructor(message: string, code?: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

/**
 * Core generic request wrapper handling JSON serialization,
 * query parameter formatting, Bearer token injection, and error normalization.
 */
async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, body, ...fetchOptions } = options;

  let url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  // Append query parameters if provided
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined) {
        searchParams.append(key, String(val));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const token = authStorage.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };

  // Automatically attach Bearer token when available
  if (token && !headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let serializedBody: BodyInit | undefined;
  if (body !== undefined) {
    serializedBody = typeof body === 'string' ? body : JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers,
      body: serializedBody,
    });
  } catch (networkError) {
    throw new ApiError(
      'Unable to connect to the Versora backend server. Please verify the API is running.',
      'NETWORK_ERROR',
      0,
      networkError
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new ApiError(
      `Received non-JSON response from server (${response.status} ${response.statusText})`,
      'INVALID_RESPONSE',
      response.status
    );
  }

  if (!response.ok) {
    const errorBody = json as { error?: { code?: string; message?: string; details?: unknown } };

    // If an authenticated request receives 401, notify listeners (skip login itself to avoid loops)
    if (response.status === 401 && !endpoint.includes('/auth/login')) {
      notifyUnauthorized();
    }

    throw new ApiError(
      errorBody?.error?.message || `Request failed with status ${response.status}`,
      errorBody?.error?.code || 'API_ERROR',
      response.status,
      errorBody?.error?.details
    );
  }

  return json as T;
}

/**
 * Centralized typed API client.
 */
export const apiClient = {
  request,
  get<T>(endpoint: string, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return request<T>(endpoint, { ...options, method: 'GET' });
  },
  post<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return request<T>(endpoint, { ...options, method: 'POST', body });
  },
  put<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return request<T>(endpoint, { ...options, method: 'PUT', body });
  },
  patch<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return request<T>(endpoint, { ...options, method: 'PATCH', body });
  },
  delete<T>(endpoint: string, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return request<T>(endpoint, { ...options, method: 'DELETE' });
  },
};

// Re-export healthService for backwards compatibility with existing imports
export { healthService };
