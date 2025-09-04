import React, { createContext, useContext, useEffect, useState } from "react";
import type { Router } from "../Router";
import { useApp } from "./AppProvider";

type RouterContextType = {
  router: Router;
  loading: boolean;
};

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const app = useApp();
  const { router } = app;
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const start = () => setLoading(true);
    const end = () => setLoading(false);

    router.on("nav:started", start);
    router.on("nav:ended", end);

    return () => {
      router.off("nav:started", start);
      router.off("nav:ended", end);
    };
  }, [router]);

  return (
    <RouterContext.Provider value={{ router, loading }}>
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
