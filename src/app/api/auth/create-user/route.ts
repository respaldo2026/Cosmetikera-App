import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const { email, password, metadata } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email y contraseña requeridos" },
        { status: 400 }
      );
    }

    // Usar createBrowserClient para signUp (no requiere SERVICE_KEY)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Registrar el usuario con signUp
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata || {},
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/auth/callback`,
      },
    });

    if (error) {
      console.error('🔴 Error en signUp:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        { success: false, error: "Usuario no creado" },
        { status: 400 }
      );
    }


    // Registrar acción en audit_logs (no bloquear si falla)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
    try {
      await fetch(appUrl + '/api/audit/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: data.user.id,
          action: 'create',
          entity: 'user',
          entity_id: data.user.id,
          details: { email, metadata },
        }),
      });
    } catch (logError) {
      console.warn('Audit log fallo, se continúa:', logError);
    }

    // Si se creó correctamente, retornar éxito
    return NextResponse.json({ 
      success: true, 
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        message: "Usuario creado exitosamente. Verifica tu email para confirmar."
      }
    });
  } catch (error: any) {
    console.error('🔴 Error en create-user:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error desconocido' },
      { status: 500 }
    );
  }
}
