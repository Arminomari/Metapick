import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole } from '@/types';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  email: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;

  setTokens: (access: string, refresh: string) => void;
  login: (data: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    email: string;
    role: UserRole;
  }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      userId: null,
      email: null,
      role: null,
      isAuthenticated: false,

      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh }),

      login: (data) =>
        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          userId: data.userId,
          email: data.email,
          role: data.role,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          userId: null,
          email: null,
          role: null,
          isAuthenticated: false,
        }),
    }),
    { name: 'creatorpay-auth',
      partialize: (state) => ({
        userId: state.userId,
        email: state.email,
        role: state.role,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
