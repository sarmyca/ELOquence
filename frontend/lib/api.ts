import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isGuestCall = url.includes('/daily/guest');
    if (error.response?.status === 401 && typeof window !== 'undefined' && !isGuestCall) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * Client's local calendar date (YYYY-MM-DD). The daily puzzle is keyed to the
 * player's local date (Wordle-style), so the backend resolves "today" from
 * this rather than its own UTC clock — otherwise a user past local midnight
 * but before UTC midnight still gets yesterday's word.
 */
function localDate(): string {
  const n = new Date();
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

// Auth
export const authApi = {
  register: (data: { email: string; username: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  google: (credential: string) =>
    api.post('/auth/google', { credential }),
  me: () => api.get('/auth/me'),
};

// Games
//
// Calls that hit a collection *root* keep a trailing slash — `/games/` (and
// likewise `/daily/`, `/leaderboard/`). Without it FastAPI 307-redirects to the
// slashed path, and iOS/WebKit drops the Authorization header across that
// redirect → "Not authenticated" on iPhone only (desktop browsers preserve it).
// Sub-path routes like `/games/${id}` are unaffected — do NOT add slashes there.
export const gamesApi = {
  create: (data: { mode: string; word_pool?: string }) =>
    api.post('/games/', data),
  submitGuess: (gameId: string, guess: string) =>
    api.post(`/games/${gameId}/guess`, { guess, local_date: localDate() }),
  get: (gameId: string) => api.get(`/games/${gameId}`),
  list: (params?: { page?: number; per_page?: number; mode?: string }) =>
    api.get('/games/', { params }),
  delete: (gameId: string) => api.delete(`/games/${gameId}`),
  /**
   * Fire-and-forget abandon used from `pagehide` (tab close, refresh,
   * navigate-away). `navigator.sendBeacon` can't attach an Authorization
   * header — we use `fetch` with `keepalive: true`, which survives the
   * unload AND accepts a Bearer token. Errors are swallowed (the page is
   * already leaving); the server-side stale-cleanup on the user's next
   * `create_game` is the safety net if this fetch never lands.
   */
  abandonBeacon: (gameId: string) => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('token');
    if (!token) return;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
    try {
      void fetch(`${API_URL}/api/games/${gameId}`, {
        method: 'DELETE',
        headers,
        keepalive: true,
      });
    } catch {
      /* page is unloading — nothing to do */
    }
  },
};

// Analysis
export const analysisApi = {
  analyze: (gameId: string) => api.post(`/analysis/games/${gameId}/analyze`),
};

// Daily
export const dailyApi = {
  get: () => api.get('/daily/', { params: { local_date: localDate() } }),
  play: () => api.post('/daily/play', null, { params: { local_date: localDate() } }),
  guest: () => api.post('/daily/guest', null, { params: { local_date: localDate() } }),
  guestGame: (gameId: string) => api.get(`/daily/guest/${gameId}`),
  guestGuess: (gameId: string, guess: string) =>
    api.post(`/daily/guest/${gameId}/guess`, { guess }),
  archive: (year: number, month: number) =>
    api.get('/daily/archive', { params: { year, month } }),
  replay: (date: string) => api.post('/daily/replay', { date }),
};

// Leaderboard
export const leaderboardApi = {
  get: (params?: { page?: number; per_page?: number }) =>
    api.get('/leaderboard/', { params }),
  nearMe: () => api.get('/leaderboard/near-me'),
  openers: (limit?: number) =>
    api.get('/leaderboard/openers', { params: limit ? { limit } : undefined }),
};

// Users
export const usersApi = {
  eloHistory: (days?: number) =>
    api.get('/users/me/elo-history', { params: days ? { days } : undefined }),
  stats: () => api.get('/users/me/stats'),
  deleteAllGames: (confirm: { password?: string; confirm_username?: string }) =>
    api.delete('/users/me/games', { data: confirm }),
  deleteAccount: (confirm: { password?: string; confirm_username?: string }) =>
    api.delete('/users/me', { data: confirm }),
};

// AI
export const aiApi = {
  explainMove: (gameId: string, moveNumber: number) =>
    api.post('/ai/explain-move', { game_id: gameId, move_number: moveNumber }),
  gameSummary: (gameId: string) =>
    api.post(`/ai/game-summary/${gameId}`),
  coachChat: (gameId: string, message: string, history: Array<{ role: string; content: string }>) =>
    api.post(`/ai/coach-chat/${gameId}`, { message, history }),
};

// Learn (trainer) progress — synced per-account so it follows the user across
// devices. `/learn/progress` is a fixed sub-path (no trailing-slash redirect
// concern). PATCH merges as a high-water mark server-side; PUT is intentionally
// avoided because the API's CORS policy doesn't allow it.
export const learnApi = {
  getProgress: () =>
    api.get<{ progress: Record<string, number> }>('/learn/progress'),
  saveProgress: (progress: Record<string, number>) =>
    api.patch<{ progress: Record<string, number> }>('/learn/progress', { progress }),
};

// Achievements
export const achievementsApi = {
  mine: () => api.get('/achievements/me'),
  all: () => api.get('/achievements/all'),
};

// Admin
export const adminApi = {
  users: (params?: { page?: number; per_page?: number; search?: string; role?: string; order_by?: string; order?: string }) =>
    api.get('/admin/users', { params }),
  user: (userId: string) => api.get(`/admin/users/${userId}`),
  resetElo: (userId: string) => api.post(`/admin/users/${userId}/reset-elo`),
  toggleAdmin: (userId: string) => api.post(`/admin/users/${userId}/toggle-admin`),
  dailyWords: () => api.get('/admin/daily-words'),
  setDailyWord: (data: { word: string; date: string; difficulty?: number }) =>
    api.post('/admin/daily-words', data),
  analytics: () => api.get('/admin/analytics'),
  timeseries: (days?: number) =>
    api.get('/admin/analytics/timeseries', { params: { days } }),
  distributions: () => api.get('/admin/analytics/distributions'),
  announcements: () => api.get('/admin/announcements'),
  createAnnouncement: (text: string) => api.post('/admin/announcements', { text }),
  updateAnnouncement: (id: string, data: { text?: string; active?: boolean }) =>
    api.patch(`/admin/announcements/${id}`, data),
  deleteAnnouncement: (id: string) => api.delete(`/admin/announcements/${id}`),
  userGames: (userId: string, params?: { page?: number; per_page?: number; mode?: string; status?: string }) =>
    api.get(`/admin/users/${userId}/games`, { params }),
  games: (params?: { page?: number; per_page?: number; user_id?: string; mode?: string; status?: string; from?: string; to?: string }) =>
    api.get('/admin/games', { params }),
  game: (gameId: string) => api.get(`/admin/games/${gameId}`),
  auditLog: (params?: { page?: number; per_page?: number; action?: string; admin_id?: string }) =>
    api.get('/admin/audit-log', { params }),
  health: () => api.get('/admin/health'),
};

// Announcements (public)
export const announcementsApi = {
  active: () => api.get('/announcements/active'),
};

// Challenges
export const challengesApi = {
  create: () => api.post('/challenges/create'),
  get: (code: string) => api.get(`/challenges/${code}`),
  play: (code: string) => api.post(`/challenges/${code}/play`),
  results: (code: string) => api.get(`/challenges/${code}/results`),
  mine: () => api.get('/challenges/mine'),
};

// Community stats
export const communityApi = {
  gameStats: (gameId: string) => api.get(`/games/${gameId}/community-stats`),
};

// Push notifications
export interface PushPreferences {
  challenge_results: boolean;
  achievement_unlock: boolean;
  daily_reminder: boolean;
  streak_warning: boolean;
}

export const pushApi = {
  vapidPublicKey: () =>
    api.get<{ public_key: string; enabled: boolean }>('/push/vapid-public-key'),
  subscribe: (subscription: PushSubscriptionJSON, userAgent?: string) =>
    api.post<{ id: string }>('/push/subscribe', {
      subscription,
      user_agent: userAgent,
    }),
  unsubscribe: (endpoint: string) =>
    api.delete<{ deleted: number }>('/push/subscribe', {
      data: { endpoint },
    }),
  test: () => api.post<{ sent: number; removed: number }>('/push/test'),
  getPreferences: () => api.get<PushPreferences>('/push/preferences'),
  updatePreferences: (patch: Partial<PushPreferences>) =>
    api.patch<PushPreferences>('/push/preferences', patch),
};

export default api;
