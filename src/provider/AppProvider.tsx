import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
} from "react";
import { RouterProvider } from "./RouterProvider";
import type { App } from "../App";

const AppContext = createContext<App | undefined>(undefined);

export function useApp(): App {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used inside <AppProvider>");
  }
  return ctx;
}

export const AppProvider: React.FC<PropsWithChildren<{ app: App }>> = ({
  app,
  children,
}) => {
  useEffect(() => {
    app.element.classList.remove("hidden");
  }, []);
  return (
    <AppContext.Provider value={app}>
      <RouterProvider>{children}</RouterProvider>
    </AppContext.Provider>
  );
};
