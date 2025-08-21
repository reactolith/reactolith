import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  PropsWithChildren,
} from "react";
import { Router } from "./Router";

type RouterLoadingContextType = {
  loading: boolean;
};

const RouterLoadingContext = createContext<RouterLoadingContextType>({
  loading: false,
});

export const RouterLoadingProvider: React.FC<
  PropsWithChildren<{ router: Router }>
> = ({ router, children }) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const start = () => {
      setLoading(true);
    };
    const end = () => {
      setLoading(false);
    };

    router.on("nav:started", start);
    router.on("nav:ended", end);

    return () => {
      router.off("nav:started", start);
      router.off("nav:ended", end);
    };
  }, [router]);

  return (
    <RouterLoadingContext.Provider value={{ loading }}>
      {children}
    </RouterLoadingContext.Provider>
  );
};

export const useRouterLoading = () => useContext(RouterLoadingContext);
