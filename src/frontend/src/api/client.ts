import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api/v1";

/**
 * Generate a UUID that works in both secure (HTTPS/localhost) and insecure (HTTP) contexts.
 * crypto.randomUUID() is only available in secure contexts.
 */
function generateUUID(): string {
  // Use crypto.randomUUID if available (secure context)
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for insecure contexts (HTTP on non-localhost)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add correlation ID for request tracing
    const correlationId = generateUUID();
    config.headers["X-Correlation-ID"] = correlationId;
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle specific error codes
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 401:
          // Handle unauthorized (if auth is added later)
          break;
        case 404:
          console.error("Resource not found:", data);
          break;
        case 500:
          console.error("Server error:", data);
          break;
      }
    } else if (error.request) {
      console.error("Network error - no response received");
    }

    return Promise.reject(error);
  }
);

export interface ApiError {
  detail: string;
  code: string;
  correlation_id?: string;
  timestamp: string;
}

export function isApiError(error: unknown): error is AxiosError<ApiError> {
  return axios.isAxiosError(error) && error.response?.data?.detail !== undefined;
}

export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.response?.data.detail || "An error occurred";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected error occurred";
}

export { apiClient };
export default apiClient;
