"use client";

import { useEffect } from "react";
import { Spin, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const { Text } = Typography;

function normalizeRole(rawRole: unknown): string {
  let normalized = typeof rawRole === "string" ? rawRole.toLowerCase() : "";

  if (["admin", "director", "administrativo"].includes(normalized)) {
    normalized = "administrador";
  }

  if (["secretaria", "asesor"].includes(normalized)) {
    normalized = "vendedor";
  }

  if (["estudiante", "egresado"].includes(normalized)) {
    normalized = "cliente";
  }

  return normalized;
}

function resolveRedirectByRole(rawRole: unknown): string {
  const role = normalizeRole(rawRole);

  if (role === "cliente") return "/club";
  if (role === "vendedor") return "/dashboard/secretaria";

  return "/";
}

export default function AccesoPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    router.replace(resolveRedirectByRole(user.rol));
  }, [loading, router, user]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
      }}
    >
      <Spin size="large" />
      <Text type="secondary">Preparando tu acceso...</Text>
    </div>
  );
}
