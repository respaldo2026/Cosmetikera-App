"use client";
import { useEffect, useState } from "react";
import { Spin } from "antd";
import AdminDashboard from "./admin";
import EstudianteDashboard from "./estudiante";
import SecretariaDashboard from "./secretaria";
import { supabaseBrowserClient as supabase } from "@utils/supabase/client";

export default function DashboardPage() {
  const [rol, setRol] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRol() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRol(null);
        setLoading(false);
        return;
      }
      const { data } = await supabase.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
      setRol(data?.rol || null);
      setLoading(false);
    }
    fetchRol();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spin tip="Cargando panel..." />
      </div>
    );
  }

  if (!rol) {
    return <div>No tienes acceso a este panel.</div>;
  }

  const normalizedRol = rol.toLowerCase();

  if (["admin", "director", "profesor"].includes(normalizedRol)) {
    return <AdminDashboard />;
  }

  if (normalizedRol === "secretaria") {
    return <SecretariaDashboard />;
  }

  if (normalizedRol === "estudiante") {
    return <EstudianteDashboard />;
  }

  return <AdminDashboard />;
}
