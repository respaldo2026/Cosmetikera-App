"use client";

import type { ReactNode } from "react";
import React, { useState, useEffect } from "react";
import { PwaInstallPrompt } from "../PwaInstallPrompt";
import { supabaseBrowserClient } from "@utils/supabase/client";

export function LoginLanding({ children }: { children: ReactNode }) {
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  const [mounted, setMounted] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [nombreAcademia, setNombreAcademia] = useState<string>("Academia Crystal Diamante");

  useEffect(() => {
    setMounted(true);
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const cargarBranding = async () => {
      const { data } = await supabaseBrowserClient
        .from("configuracion")
        .select("nombre_academia, logo_url")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (data?.logo_url) setLogoUrl(data.logo_url);
      if (data?.nombre_academia) setNombreAcademia(data.nombre_academia);
    };

    cargarBranding();
  }, []);

  if (!mounted) return null;

  const isMobile = windowWidth < 768;
  const isTablet = windowWidth < 1024;

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        background: "linear-gradient(180deg, #f8f9fc 0%, #eef1f7 100%)",
        position: "relative",
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: isMobile ? "20px" : "40px",
        paddingBottom: isMobile ? "20px" : "40px",
        paddingLeft: isMobile ? "12px" : "20px",
        paddingRight: isMobile ? "12px" : "20px",
      }}
    >
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: isMobile ? "96%" : "460px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            borderRadius: 16,
            padding: isMobile ? "16px" : "20px",
            background: "#ffffff",
            border: "1px solid #e6eaf2",
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={nombreAcademia}
              style={{
                maxHeight: isMobile ? 54 : 64,
                maxWidth: "100%",
                objectFit: "contain",
              }}
            />
          ) : null}

          <h1
            style={{
              margin: 0,
              fontSize: isMobile ? "1.15rem" : "1.3rem",
              fontWeight: 700,
              color: "#1f2937",
              textAlign: "center",
            }}
          >
            {nombreAcademia}
          </h1>
        </div>

        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            justifyContent: "center",
          }}
        >
          <PwaInstallPrompt inline={true} />
          {children}
        </div>
      </div>
    </div>
  );
}
