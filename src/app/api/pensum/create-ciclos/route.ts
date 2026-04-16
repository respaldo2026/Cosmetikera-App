import { createServerClient } from "@supabase/ssr";
import { CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_KEY, SUPABASE_URL } from "@utils/supabase/constants";

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY;

export async function POST(request: Request) {
  try {
    const { programaId, ciclosFaltantes } = await request.json();

    if (!programaId || !ciclosFaltantes || ciclosFaltantes.length === 0) {
      return Response.json(
        { error: "Missing programaId or ciclosFaltantes" },
        { status: 400 }
      );
    }

    // Crear cliente con SERVICE_ROLE_KEY para bypasear RLS
    const cookieStore = await cookies();
    const supabase = createServerClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Ignored
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (error) {
            // Ignored
          }
        },
      },
    });

    const { data, error } = await supabase
      .from("pensum")
      .insert(ciclosFaltantes);

    if (error) {
      console.error("Error inserting ciclos:", error);
      return Response.json(
        { error: error.message, details: error },
        { status: 500 }
      );
    }


    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (appUrl) {
      try {
        const auditUrl = new URL('/api/audit/log', appUrl).toString();

        await fetch(auditUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: null, // Reemplazar por el id del usuario si está disponible
            action: 'create',
            entity: 'pensum_ciclo',
            entity_id: programaId,
            details: { ciclosFaltantes },
          }),
        });
      } catch (logErr) {
        console.warn('Audit log fallo (continuando):', logErr);
      }
    }

    return Response.json({ success: true, data });
  } catch (error) {
    console.error("API error:", error);
    return Response.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
