"use client";

import { useEffect } from "react";

export const PwaRegister = () => {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    const shouldRegister = process.env.NODE_ENV === "production" && !isLocalhost;

    if (!shouldRegister) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().catch(() => {});
        });
      });

      if ("caches" in window) {
        caches.keys().then((cacheKeys) => {
          cacheKeys.forEach((cacheKey) => {
            caches.delete(cacheKey).catch(() => {});
          });
        });
      }

      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
};
