import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, rol, user_metadata } = body;

    console.log("[CREATE-USER] Request received:", { email, rol });

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son obligatorios' }, { status: 400 });
    }

    // Inicializar cliente Admin de Supabase (Solo servidor)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log("[CREATE-USER] Supabase admin client initialized");

    // 1. Crear usuario en Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto confirmar email
      user_metadata: {
        ...user_metadata,
        rol,
      },
    });

    if (authError) {
      console.error("[CREATE-USER] Auth error:", authError);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;
    console.log("[CREATE-USER] User created with ID:", userId);

    // 2. Crear/actualizar el perfil público (con upsert para asegurar que exista)
    console.log("[CREATE-USER] Upserting profile with data:", { id: userId, ...user_metadata, rol, email });
    
    const { error: profileError } = await supabaseAdmin
      .from('perfiles')
      .upsert({
        id: userId,
        ...user_metadata,
        rol,
        email,
      }, { onConflict: 'id' });

    if (profileError) {
        console.error("[CREATE-USER] Profile error:", profileError);
        // No retornamos error 500 porque el usuario Auth ya se creó, es mejor avisar
        return NextResponse.json({ user: authData.user, warning: "Usuario creado pero hubo un error actualizando detalles del perfil." });
    }

    console.log("[CREATE-USER] Profile created successfully");

    const { data: perfil } = await supabaseAdmin
      .from('perfiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    console.log("[CREATE-USER] Profile verification:", perfil);

    // 3. Registrar acción en audit_logs (no bloquear si falta URL)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
    try {
      await fetch(appUrl + '/api/audit/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          action: 'create',
          entity: 'user',
          entity_id: userId,
          details: { email, rol, user_metadata },
        }),
      });
    } catch (logErr) {
      console.warn('Audit log fallo (se continúa):', logErr);
    }

    console.log("[CREATE-USER] Success");
    return NextResponse.json({ user: authData.user, perfil, message: 'Usuario creado exitosamente' });

  } catch (error: any) {
    console.error("[CREATE-USER] Fatal error:", error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}