"use client";

import { useEffect, useState } from "react";
import { CloseOutlined } from "@ant-design/icons";

type DeferredPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

interface PwaInstallPromptProps {
  inline?: boolean;
}

export const PwaInstallPrompt = ({ inline = false }: PwaInstallPromptProps) => {
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredPrompt | null>(null);
  const [visible, setVisible] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);
  const [guideFor, setGuideFor] = useState<"ios" | "android" | "desktop" | null>(null);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    setIsStandalone(standalone);

    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform("ios");
    } else if (/android/.test(ua)) {
      setPlatform("android");
    } else {
      setPlatform("desktop");
    }

    if (standalone) return;

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredPrompt);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, []);

  if (!visible || isStandalone) return null;

  const handleInstallAndroid = async () => {
    if (!deferredPrompt) {
      setGuideFor("android");
      return;
    }
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") setVisible(false);
    setDeferredPrompt(null);
  };

  const handleInstallIOS = () => {
    setGuideFor("ios");
    if (typeof window !== "undefined") {
      window.alert("Para instalar en iPhone/iPad:\n1) Toca Compartir (□↗)\n2) Elige 'Agregar a pantalla de inicio'");
    }
  };

  const handleInstall = async () => {
    if (platform === "ios") {
      handleInstallIOS();
      return;
    }
    await handleInstallAndroid();
  };

  const activeGuidePlatform = guideFor ?? platform;
  const guideText =
    activeGuidePlatform === "ios"
      ? "En iPhone/iPad: abre el menú Compartir (□↗) y pulsa 'Agregar a pantalla de inicio'."
      : activeGuidePlatform === "android"
      ? "En Android: abre el menú del navegador (⋮) y pulsa 'Instalar app' o 'Agregar a pantalla principal'."
      : "En escritorio: usa el icono de instalar en la barra de direcciones del navegador.";

  const actionLabel = deferredPrompt ? "Instalar" : "Cómo instalar";

  const inlineGuide = guideFor ? (
    <div
      style={{
        marginTop: 8,
        borderRadius: 8,
        background: "rgba(255,255,255,0.16)",
        padding: "8px 10px",
        color: "#fff",
        fontSize: 11,
        lineHeight: 1.35,
      }}
    >
      {guideText}
    </div>
  ) : null;

  const floatingGuide = guideFor ? (
    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.95)", marginTop: 6, maxWidth: 240, lineHeight: 1.35 }}>
      {guideText}
    </div>
  ) : null;

  const closePrompt = () => {
    setVisible(false);
    setGuideFor(null);
  };

  if (inline) {
    return (
      <div style={{ width: "100%" }}>
        <div
          style={{
            background: "linear-gradient(135deg, rgba(255, 42, 161, 0.9), rgba(255, 107, 181, 0.9))",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            borderRadius: 10,
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            boxShadow: "0 4px 12px rgba(255, 42, 161, 0.2)",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#ffffff" }}>
              📱 Instalar App
            </div>
            <div style={{ fontSize: 10, fontWeight: 500, color: "rgba(255, 255, 255, 0.9)" }}>
              Android o iPhone/iPad
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={handleInstallAndroid}
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                color: "#ff2aa1",
                border: "none",
                borderRadius: 6,
                padding: "5px 10px",
                fontWeight: 700,
                fontSize: 11,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s ease",
              }}
            >
              Android
            </button>
            <button
              type="button"
              onClick={handleInstallIOS}
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                color: "#ff2aa1",
                border: "none",
                borderRadius: 6,
                padding: "5px 10px",
                fontWeight: 700,
                fontSize: 11,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s ease",
              }}
            >
              iPhone/iPad
            </button>
            <button
              type="button"
              onClick={closePrompt}
              title="Cerrar"
              style={{
                background: "none",
                border: "none",
                color: "#ffffff",
                fontSize: 14,
                cursor: "pointer",
                padding: "2px 4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
                opacity: 0.8,
              }}
            >
              <CloseOutlined />
            </button>
          </div>
        </div>
        {inlineGuide}
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 1200,
        background: "linear-gradient(135deg, rgba(255, 42, 161, 0.95), rgba(255, 107, 181, 0.95))",
        border: "1px solid rgba(255, 255, 255, 0.3)",
        borderRadius: 12,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        boxShadow: "0 8px 20px rgba(255, 42, 161, 0.25)",
        backdropFilter: "blur(10px)",
        maxWidth: 280,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff" }}>
          📱 Instalar App
        </div>
        <div style={{ fontSize: 11, fontWeight: 500, color: "rgba(255, 255, 255, 0.9)" }}>
          Android o iPhone/iPad
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={handleInstallAndroid}
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            color: "#ff2aa1",
            border: "none",
            borderRadius: 8,
            padding: "6px 12px",
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            const target = e.currentTarget as HTMLButtonElement;
            target.style.background = "#ffffff";
            target.style.transform = "scale(1.05)";
          }}
          onMouseLeave={(e) => {
            const target = e.currentTarget as HTMLButtonElement;
            target.style.background = "rgba(255, 255, 255, 0.95)";
            target.style.transform = "scale(1)";
          }}
        >
          Android
        </button>
        <button
          type="button"
          onClick={handleInstallIOS}
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            color: "#ff2aa1",
            border: "none",
            borderRadius: 8,
            padding: "6px 12px",
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            const target = e.currentTarget as HTMLButtonElement;
            target.style.background = "#ffffff";
            target.style.transform = "scale(1.05)";
          }}
          onMouseLeave={(e) => {
            const target = e.currentTarget as HTMLButtonElement;
            target.style.background = "rgba(255, 255, 255, 0.95)";
            target.style.transform = "scale(1)";
          }}
        >
          iPhone/iPad
        </button>
        <button
          type="button"
          onClick={closePrompt}
          title="Cerrar"
          style={{
            background: "none",
            border: "none",
            color: "#ffffff",
            fontSize: 16,
            cursor: "pointer",
            padding: "4px 4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s ease",
            opacity: 0.8,
          }}
          onMouseEnter={(e) => {
            const target = e.currentTarget as HTMLButtonElement;
            target.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            const target = e.currentTarget as HTMLButtonElement;
            target.style.opacity = "0.8";
          }}
        >
          <CloseOutlined />
        </button>
      </div>
      {floatingGuide}
    </div>
  );
};
