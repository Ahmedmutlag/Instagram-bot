"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, getToken, setToken } from "@/lib/api";
import type { Admin } from "@/types";

interface AuthContextValue {
  admin: Admin | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const existing = getToken();
    if (!existing) {
      setLoading(false);
      return;
    }
    setTokenState(existing);
    api
      .get<Admin>("/auth/me")
      .then((data) => {
        setAdmin(data);
      })
      .catch(() => {
        setToken(null);
        setTokenState(null);
        setAdmin(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await api.post<{ token: string; admin: Admin }>(
        "/auth/login",
        { email, password }
      );
      setToken(result.token);
      setTokenState(result.token);
      setAdmin(result.admin);
    },
    []
  );

  const logout = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setAdmin(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo(
    () => ({ admin, token, loading, login, logout }),
    [admin, token, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "حدث خطأ غير متوقع، يرجى المحاولة لاحقاً.";
}
