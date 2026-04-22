"use client";

import Cookies from "js-cookie";
import React, {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ColorMode = "light" | "dark";

type ColorModeContextType = {
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
  toggle: () => void;
};

export const ColorModeContext = createContext<ColorModeContextType | undefined>(
  undefined,
);

type ColorModeContextProviderProps = {
  defaultMode?: ColorMode;
};

export const ColorModeContextProvider: React.FC<
  PropsWithChildren<ColorModeContextProviderProps>
> = ({ children, defaultMode = "light" }) => {
  const [mode, setModeState] = useState<ColorMode>("light");

  useEffect(() => {
    const nextMode: ColorMode = "light";
    setModeState(nextMode);
    Cookies.set("theme", nextMode, { expires: 365 });

    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = nextMode;
      document.body.style.backgroundColor = "#FFFFFF";
      document.body.style.color = "#111827";
    }
  }, [defaultMode]);

  const setMode = useCallback((nextMode: ColorMode) => {
    const safeMode: ColorMode = nextMode === "dark" ? "light" : "light";
    setModeState(safeMode);
    Cookies.set("theme", safeMode, { expires: 365 });

    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = safeMode;
      document.body.style.backgroundColor = "#FFFFFF";
      document.body.style.color = "#111827";
      document.body.style.transition = "background-color 0.25s ease, color 0.25s ease";
    }
  }, []);

  const toggle = useCallback(() => {
    setMode("light");
  }, [mode, setMode]);

  const value = useMemo(
    () => ({ mode, setMode, toggle }),
    [mode, setMode, toggle],
  );

  return <ColorModeContext.Provider value={value}>{children}</ColorModeContext.Provider>;
};

export const useColorMode = () => {
  const context = useContext(ColorModeContext);

  if (!context) {
    throw new Error("useColorMode must be used within ColorModeContextProvider");
  }

  return context;
};
