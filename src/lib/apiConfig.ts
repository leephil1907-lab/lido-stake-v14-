export interface ApiLogEntry {
  id: string;
  timestamp: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  status: 'SUCCESS' | 'FAILED';
  httpStatus: number;
  wallet?: string;
  latencyMs: number;
  requestPayload?: any;
  responsePayload?: any;
  errorMessage?: string;
}

const API_ENDPOINT_STORAGE_KEY = 'lido_custom_api_endpoint_url';
const API_LOGS_STORAGE_KEY = 'lido_signature_api_logs_v1';
const DEFAULT_API_ENDPOINT = typeof window !== 'undefined' ? window.location.origin : '';

/**
 * Get configured backend API base URL (stored in localStorage or fallback to origin)
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const saved = localStorage.getItem(API_ENDPOINT_STORAGE_KEY);
  if (saved && saved.trim()) {
    return saved.trim().replace(/\/+$/, ''); // Remove trailing slashes
  }
  return window.location.origin;
}

/**
 * Save custom backend API base URL to localStorage and notify global listeners
 */
export function setApiBaseUrl(url: string): void {
  if (typeof window === 'undefined') return;
  const cleanUrl = url.trim().replace(/\/+$/, '');
  localStorage.setItem(API_ENDPOINT_STORAGE_KEY, cleanUrl);
  window.dispatchEvent(new CustomEvent('lido_api_endpoint_updated', { detail: cleanUrl }));
}

/**
 * Reset API base URL to default origin
 */
export function resetApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  localStorage.removeItem(API_ENDPOINT_STORAGE_KEY);
  const defaultUrl = window.location.origin;
  window.dispatchEvent(new CustomEvent('lido_api_endpoint_updated', { detail: defaultUrl }));
  return defaultUrl;
}

/**
 * Get stored API logs for signature verifications and endpoints
 */
export function getApiLogs(): ApiLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(API_LOGS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load api logs:', e);
    return [];
  }
}

/**
 * Record a new API request/response audit entry
 */
export function logApiCall(entry: Omit<ApiLogEntry, 'id' | 'timestamp'>): ApiLogEntry {
  const newEntry: ApiLogEntry = {
    ...entry,
    id: `apilog-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      const existing = getApiLogs();
      const updated = [newEntry, ...existing].slice(0, 200); // retain last 200 logs
      localStorage.setItem(API_LOGS_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('lido_api_logs_updated'));
    } catch (e) {
      console.error('Failed to save api log:', e);
    }
  }

  return newEntry;
}

/**
 * Clear all API logs
 */
export function clearApiLogs(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(API_LOGS_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('lido_api_logs_updated'));
}
