import React, { PropsWithChildren } from "react";
import { RouterLoadingProvider } from "./RouterLoadingProvider";
import { App } from "./App";

export const AppProvider: React.FC<PropsWithChildren<{ app: App }>> = ({
  app,
  children,
}) => {
  return (
    <RouterLoadingProvider router={app.router}>
      {children}
    </RouterLoadingProvider>
  );
};
