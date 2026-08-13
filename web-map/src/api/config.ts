import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { store } from '../store/store.ts';
import { setActingAsUserId, setModSwitch } from '../store/slices/modSlice.ts';

// Set by useSnackbarInterceptor hook; called for every non-401 API error
let _onApiError: ((msg: string) => void) | null = null;
export const setApiErrorHandler = (fn: (msg: string) => void) => { _onApiError = fn; };

// Exported so components can build absolute URLs for raw <img>/<a> tags (e.g. flags), which
// — unlike everything else — go directly to the browser rather than through this axios
// instance, so they need the base URL prefixed onto the API-relative path themselves.
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Mod layer: while a mod is "playing" an NPC country, every game request is attributed to
// that NPC server-side (ActAsInterceptor). Never attached to /auth/* — impersonation must
// never affect the mod's own login/refresh/session.
//
// Separately, while the Mod switch is on, ADMIN/MODERATOR accounts also get a no-fog-of-war
// header so /armies/all and /provinces/state return every player's buildings/armies
// unfiltered (see api/src/utils/mod-visibility.ts). Gating on `state.user.role` here is
// just a client-side nicety — the server re-validates the real authenticated role itself
// and ignores the header entirely for non-mods, so this can't be used to escalate access.
apiClient.interceptors.request.use((config) => {
  const state = store.getState();
  const actingAsUserId = state.mod.actingAsUserId;
  if (actingAsUserId && !config.url?.startsWith('/auth')) {
    config.headers['X-Act-As-User'] = actingAsUserId;
  }
  const isMod = state.user.role === 'ADMIN' || state.user.role === 'MODERATOR';
  if (isMod && state.mod.switchOn && !config.url?.startsWith('/auth')) {
    config.headers['X-Mod-Full-Visibility'] = 'true';
  }
  return config;
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

// Forces the current session out to /login, clearing the mod-impersonation state the same
// way the 401/refresh-failure branch below already does (see its comment) — shared because
// the GAME_PAUSED branch needs the identical cleanup.
const forceLogoutToLogin = async () => {
  try {
    await apiClient.post('/auth/logout');
  } catch {
    // Ignore logout errors — we're redirecting regardless.
  }
  store.dispatch(setActingAsUserId(null));
  store.dispatch(setModSwitch(false));
  window.location.href = '/login';
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
        await forceLogoutToLogin();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Game paused mid-session (see GamePauseInterceptor, api/src/settings/): kick the player
    // to the login screen, which reads /game-settings itself to show why. Excludes /auth/login
    // and /auth/register — a PLAYER hitting GAME_PAUSED there is already on the login screen
    // submitting the form, and should see the message inline (LoginPage's own catch handles
    // it) rather than being redirected away from the page they're already on.
    const isAuthLoginOrRegister = originalRequest.url?.startsWith('/auth/login') || originalRequest.url?.startsWith('/auth/register');
    if (error.response?.status === 403 && (error.response?.data as any)?.code === 'GAME_PAUSED' && !isAuthLoginOrRegister) {
      await forceLogoutToLogin();
      return Promise.reject(error);
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
