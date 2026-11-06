import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  fullName: string;
  hoTen?: string;
  mssv?: string | null;
  phone?: string;
  avatarUrl?: string;
  role?: string;
  roles: string[];
  eligible?: boolean;
  duDieuKienDangKyKLTN?: boolean;
  trangThaiKLTN?: string;
  studentProfile?: {
    studentCode: string;
    className?: string;
    cohort?: number;
    gpa?: number;
    creditsEarned: number;
    eligible: boolean;
    department?: { name: string; code: string };
  };
  lecturerProfile?: {
    lecturerCode: string;
    title?: string;
    specialization?: string;
    maxGroups: number;
    department?: { name: string; code: string };
  };
}

interface AuthState {
  accessToken: string | null;
  user: User | null;
  activeRole: string | null;
  activeTab: string | null;
  unreadCount: number;
  setActiveRole: (role: string, targetTab?: string) => void;
  setActiveTab: (tab: string | null) => void;
  setSession: (accessToken: string, user: User) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: User) => void;
  setUnreadCount: (count: number) => void;
  decrementUnread: () => void;
  logout: () => void;
}

function getInitialToken(): string | null {
  try {
    return localStorage.getItem('kltn_token') ?? null;
  } catch {
    return null;
  }
}

function getInitialUser(): User | null {
  try {
    const raw = localStorage.getItem('kltn_user');
    if (raw && raw !== 'undefined' && raw !== 'null') {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (!parsed.roles && parsed.role) {
          parsed.roles = [parsed.role];
        } else if (!parsed.roles) {
          parsed.roles = ['SINH_VIEN'];
        }
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to parse kltn_user from localStorage:', e);
    try {
      localStorage.removeItem('kltn_user');
    } catch {
      // ignore
    }
  }
  return null;
}

function getInitialActiveRole(user: User | null): string | null {
  try {
    const saved = localStorage.getItem('kltn_active_role');
    if (saved) return saved;
  } catch {}
  return user?.role || user?.roles?.[0] || null;
}

const initialUser = getInitialUser();

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: getInitialToken(),
  user: initialUser,
  activeRole: getInitialActiveRole(initialUser),
  activeTab: null,
  unreadCount: 0,
  setActiveRole: (role, targetTab) => {
    try {
      localStorage.setItem('kltn_active_role', role);
    } catch {}
    set({ activeRole: role, activeTab: targetTab ?? null });
  },
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSession: (accessToken, user) => {
    const initRole = user.role || user.roles?.[0] || 'SINH_VIEN';
    try {
      localStorage.setItem('kltn_token', accessToken);
      localStorage.setItem('kltn_user', JSON.stringify(user));
      localStorage.setItem('kltn_active_role', initRole);
    } catch (e) {
      console.warn('Failed to save session to localStorage:', e);
    }
    set({ accessToken, user, activeRole: initRole, activeTab: null });
  },
  setAccessToken: (accessToken) => {
    try {
      localStorage.setItem('kltn_token', accessToken);
    } catch (e) {
      console.warn('Failed to save token to localStorage:', e);
    }
    set({ accessToken });
  },
  setUser: (user) => {
    try {
      localStorage.setItem('kltn_user', JSON.stringify(user));
    } catch (e) {
      console.warn('Failed to save user to localStorage:', e);
    }
    set({ user });
  },
  setUnreadCount: (count) => set({ unreadCount: count }),
  decrementUnread: () => set((state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) })),
  logout: () => {
    try {
      localStorage.removeItem('kltn_token');
      localStorage.removeItem('kltn_user');
      localStorage.removeItem('kltn_active_role');
    } catch {
      // ignore
    }
    set({ accessToken: null, user: null, activeRole: null, activeTab: null, unreadCount: 0 });
  },
}));

