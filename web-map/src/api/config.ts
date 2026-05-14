import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Set by useSnackbarInterceptor hook; called for every non-401 API error
let _onApiError: ((msg: string) => void) | null = null;
export const setApiErrorHandler = (fn: (msg: string) => void) => { _onApiError = fn; };

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: AxiosError | null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });

  failedQueue = [];
};

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _skipAuthRedirect?: boolean };

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest._skipAuthRedirect) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => apiClient(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Try to refresh the token
        await apiClient.post('/auth/refresh');
        processQueue(null);
        return apiClient(originalRequest);
      } catch (refreshError) {
        // If refresh fails, logout and redirect to login
        processQueue(refreshError as AxiosError);
        try {
          await apiClient.post('/auth/logout');
        } catch (logoutError) {
          // Ignore logout errors
        }
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Show generic error for non-401 responses
    if (error.response?.status !== 401) {
      const message =
        (error.response?.data as any)?.message ||
        error.message ||
        'An unexpected error occurred';
      _onApiError?.(Array.isArray(message) ? message.join(', ') : String(message));
    }

    return Promise.reject(error);
  }
);
