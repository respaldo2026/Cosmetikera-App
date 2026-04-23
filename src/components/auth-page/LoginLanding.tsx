"use client";

import type { ReactNode } from "react";
import React, { useState, useEffect } from "react";
import { GiftFilled } from "@ant-design/icons";
import { PwaInstallPrompt } from "../PwaInstallPrompt";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { isMissingSupabaseRelationError } from "@/utils/supabase/optional";

export function LoginLanding({ children }: { children?: ReactNode }) {
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  const [mounted, setMounted] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [nombreAcademia, setNombreAcademia] = useState<string>("La Cosmetikera");

  useEffect(() => {
    setMounted(true);
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const cargarBranding = async () => {
      const { data, error } = await supabaseBrowserClient
        .from("configuracion")
        .select("nombre_academia, logo_url")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if (!isMissingSupabaseRelationError(error)) {
          console.error("Error cargando branding del login:", error);
        }
        return;
      }

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
            border: "1px solid #ffd6e7",
            boxShadow: "0 12px 24px rgba(216, 27, 135, 0.12)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: isMobile ? 54 : 60,
              height: isMobile ? 54 : 60,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #d81b87 0%, #ff4fa3 100%)",
              color: "#ffffff",
              boxShadow: "0 10px 18px rgba(216, 27, 135, 0.35)",
              fontSize: isMobile ? 26 : 30,
            }}
            aria-label="Icono La Cosmetikera"
          >
            <GiftFilled />
          </div>

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
              color: "#8a0f57",
              textAlign: "center",
            }}
          >
            {nombreAcademia}
          </h1>

          <p
            style={{
              margin: 0,
              color: "#9d174d",
              fontSize: isMobile ? 12 : 13,
              textAlign: "center",
            }}
          >
            Tu sistema POS y fidelizacion de clientes
          </p>
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
