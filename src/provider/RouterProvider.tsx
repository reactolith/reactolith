import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Router } from "../Router";
import { useApp } from "./AppProvider";

type RenderFailedPayload = {
  /** whatever your router emits, kept as unknown to avoid tight coupling */
  input: unknown;
  init: unknown;
  pushState: unknown;
  response: unknown;
  html: unknown;
  finalUrl: unknown;
};

export type RenderError = RenderFailedPayload & {
  /** increments for every error so consumers can re-open dialogs */
  id: number;
  /** when the error was captured */
  timestamp: number;
};

type RouterContextType = {
  router: Router;
  loading: boolean;
  /** last render error (if any) */
  lastError: RenderError | null;
  /** clear currently shown error (e.g., when dialog is closed) */
  clearError: () => void;
};

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const { router } = useApp();
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<RenderError | null>(null);
  const errorId = useRef(0);

  useEffect(() => {
    const start = () => setLoading(true);
    const end = () => setLoading(false);

    // The router emits: "render:failed", input, init, pushState, response, html, finalUrl
    const onRenderFailed = (
      input: unknown,
      init: unknown,
      pushState: unknown,
      response: unknown,
      html: unknown,
      finalUrl: unknown,
    ) => {
      errorId.current += 1;
      setLastError({
        id: errorId.current,
        timestamp: Date.now(),
        input,
        init,
        pushState,
        response,
        html,
        finalUrl,
      });
    };

    router.on("nav:started", start);
    router.on("nav:ended", end);
    router.on("render:failed", onRenderFailed);

    return () => {
      router.off("nav:started", start);
      router.off("nav:ended", end);
      router.off("render:failed", onRenderFailed);
    };
  }, [router]);

  const clearError = () => setLastError(null);

  return (
    <RouterContext.Provider value={{ router, loading, lastError, clearError }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter(): RouterContextType {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error("useRouter must be used inside <RouterProvider>");
  }
  return ctx;
}
