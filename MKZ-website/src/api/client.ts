/**
 * API client for the MKZ backend.
 * All endpoints proxy through Vite to http://localhost:8080.
 */

const BASE_URL = '/api';

interface ApiError {
  error: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });
  } catch (err) {
    // Network error — backend is down, no internet, CORS, etc.
    throw new Error('Could not reach the server. Is the backend running?');
  }

  if (!response.ok) {
    const data: ApiError = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ─── Auth ────────────────────────────────────────────────────────────

export interface User {
  userId: string;
  displayName: string;
  countryCode: string;
  lastLogin: string;
  createdAt: string;
}

export interface LoginResponse {
  user: User;
}

export const auth = {
  register: (displayName: string, countryCode: string) =>
    request<LoginResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ displayName, countryCode }),
    }),

  login: (userId: string) =>
    request<LoginResponse>(`/auth/login/${userId}`, { method: 'POST' }),

  getUser: (userId: string) =>
    request<User>(`/auth/user/${userId}`),
};

// ─── Plates ──────────────────────────────────────────────────────────

export interface PlateCollectionResult {
  plate: {
    id: number;
    userId: string;
    plateText: string;
    region: string | null;
    city: string | null;
    imageUrl: string | null;
    collectedAt: string;
  };
  challengeUpdates: Array<{
    challengeId: number;
    challengeName: string;
    previousScore: number;
    newScore: number;
  }>;
}

export const plates = {
  collect: (userId: string, plateText: string, region?: string, city?: string, imageUrl?: string) =>
    request<PlateCollectionResult>(`/plates/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ plateText, region, city, imageUrl }),
    }),

  getUserPlates: (userId: string) =>
    request<PlateCollectionResult['plate'][]>(`/plates/${userId}`),

  getCount: (userId: string) =>
    request<{ count: number }>(`/plates/${userId}/count`),

  getRegions: (userId: string) =>
    request<{ regions: string[] }>(`/plates/${userId}/regions`),
};

// ─── Challenges ──────────────────────────────────────────────────────

export interface Challenge {
  id: number;
  name: string;
  description: string | null;
  goal: string;
  specialRules: string | null;
  constellation: string;
  timeFrameStart: string | null;
  timeFrameEnd: string | null;
  rewards: string | null;
  defaultVisibility: string;
  active: boolean;
  createdAt: string;
  participantCount: number;
}

export interface Leaderboard {
  challengeId: number;
  challengeName: string;
  entries: Array<{
    rank: number;
    userId: string;
    displayName: string;
    score: number;
    isFriend: boolean;
  }>;
  userRank: number | null;
  userScore: number | null;
}

export const challenges = {
  getActive: () =>
    request<Challenge[]>('/challenges'),

  get: (id: number) =>
    request<Challenge>(`/challenges/${id}`),

  getUserChallenges: (userId: string) =>
    request<Challenge[]>(`/challenges/user/${userId}`),

  join: (challengeId: number, userId: string, visibility?: string) =>
    request<any>(`/challenges/${challengeId}/join/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ visibility }),
    }),

  getLeaderboard: (challengeId: number, viewerUserId: string) =>
    request<Leaderboard>(`/challenges/${challengeId}/leaderboard/${viewerUserId}`),

  submit: (challengeId: number, userId: string, data: string, score: number) =>
    request<any>(`/challenges/${challengeId}/submit/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ submissionData: data, submissionScore: score }),
    }),
};

// ─── Friends ─────────────────────────────────────────────────────────

export interface Friend {
  userId: string;
  displayName: string;
  status: string;
  createdAt: string;
}

export const friends = {
  list: (userId: string) =>
    request<Friend[]>(`/friends/${userId}`),

  sendRequest: (userId: string, friendId: string) =>
    request<any>(`/friends/${userId}/request`, {
      method: 'POST',
      body: JSON.stringify({ friendId }),
    }),

  accept: (userId: string, requesterId: string) =>
    request<any>(`/friends/${userId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ friendId: requesterId }),
    }),
};

// ─── Profile ─────────────────────────────────────────────────────────

export interface UserProfile {
  userId: string;
  profilePictureUrl: string | null;
  city: string | null;
  whoCanAddMe: string;
  whoCanSeeProfile: string;
  hotStreakDays: number;
  activeBackgroundColour: { colourValue: string; label: string } | null;
  activeBorderColour: { colourValue: string; label: string } | null;
  activeNameColour: { colourValue: string; label: string } | null;
  displayedTrophies: Array<{
    trophyName: string;
    trophyIconKey: string;
    place: number | null;
    score: number | null;
  }>;
}

export const profile = {
  get: (userId: string) =>
    request<UserProfile>(`/profile/${userId}`),

  update: (userId: string, data: Partial<Pick<UserProfile, 'city' | 'whoCanAddMe' | 'whoCanSeeProfile'>>) =>
    request<UserProfile>(`/profile/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  recordActivity: (userId: string) =>
    request<{ hotStreakDays: number }>(`/profile/${userId}/activity`, { method: 'POST' }),
};

export default { auth, plates, challenges, friends, profile };
