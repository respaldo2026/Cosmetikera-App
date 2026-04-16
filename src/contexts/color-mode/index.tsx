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
> = ({ children, defaultMode = "dark" }) => {
  const [mode, setModeState] = useState<ColorMode>(defaultMode);

  useEffect(() => {
    const stored = Cookies.get("theme");
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    const nextMode =
      stored === "light" || stored === "dark"
        ? stored
        : prefersDark
          ? "dark"
          : defaultMode;

    setModeState(nextMode as ColorMode);

    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = nextMode;
      document.body.style.backgroundColor =
        nextMode === "dark" ? "#0B1220" : "#FFFFFF";
      document.body.style.color = nextMode === "dark" ? "#E5E7EB" : "#111827";
    }
  }, [defaultMode]);

  const setMode = useCallback((nextMode: ColorMode) => {
    setModeState(nextMode);
    Cookies.set("theme", nextMode, { expires: 365 });

    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = nextMode;
      document.body.style.backgroundColor =
        nextMode === "dark" ? "#0B1220" : "#FFFFFF";
      document.body.style.color = nextMode === "dark" ? "#E5E7EB" : "#111827";
      document.body.style.transition = "background-color 0.25s ease, color 0.25s ease";
    }
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
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
