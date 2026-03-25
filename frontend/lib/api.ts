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
export const gamesApi = {
  create: (data: { mode: string; word_pool?: string }) =>
    api.post('/games', data),
  submitGuess: (gameId: string, guess: string) =>
    api.post(`/games/${gameId}/guess`, { guess }),
  get: (gameId: string) => api.get(`/games/${gameId}`),
  list: (params?: { page?: number; per_page?: number; mode?: string }) =>
    api.get('/games', { params }),
  delete: (gameId: string) => api.delete(`/games/${gameId}`),
};

// Analysis
export const analysisApi = {
  analyze: (gameId: string) => api.post(`/analysis/games/${gameId}/analyze`),
};

// Daily
export const dailyApi = {
  get: () => api.get('/daily'),
  play: (rated?: boolean) => api.post('/daily/play', null, { params: rated ? { rated: true } : undefined }),
  guest: () => api.post('/daily/guest'),
  guestGame: (gameId: string) => api.get(`/daily/guest/${gameId}`),
  guestGuess: (gameId: string, guess: string) =>
    api.post(`/daily/guest/${gameId}/guess`, { guess }),
};

// Leaderboard
export const leaderboardApi = {
  get: (params?: { page?: number; per_page?: number }) =>
    api.get('/leaderboard', { params }),
  nearMe: () => api.get('/leaderboard/near-me'),
};

// Users
export const usersApi = {
  eloHistory: (days?: number) =>
    api.get('/users/me/elo-history', { params: days ? { days } : undefined }),
  stats: () => api.get('/users/me/stats'),
  deleteAllGames: () => api.delete('/users/me/games'),
  deleteAccount: () => api.delete('/users/me'),
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

// Achievements
export const achievementsApi = {
  mine: () => api.get('/achievements/me'),
  all: () => api.get('/achievements/all'),
};

// Admin
export const adminApi = {
  users: (params?: { page?: number; search?: string }) =>
    api.get('/admin/users', { params }),
  user: (userId: string) => api.get(`/admin/users/${userId}`),
  resetElo: (userId: string) => api.post(`/admin/users/${userId}/reset-elo`),
  toggleAdmin: (userId: string) => api.post(`/admin/users/${userId}/toggle-admin`),
  dailyWords: () => api.get('/admin/daily-words'),
  setDailyWord: (data: { word: string; date: string; difficulty?: number }) =>
    api.post('/admin/daily-words', data),
  analytics: () => api.get('/admin/analytics'),
  announcements: () => api.get('/admin/announcements'),
  createAnnouncement: (text: string) => api.post('/admin/announcements', { text }),
  updateAnnouncement: (id: string, data: { text?: string; active?: boolean }) =>
    api.patch(`/admin/announcements/${id}`, data),
  deleteAnnouncement: (id: string) => api.delete(`/admin/announcements/${id}`),
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
};

// Community stats
export const communityApi = {
  gameStats: (gameId: string) => api.get(`/games/${gameId}/community-stats`),
};

export default api;
