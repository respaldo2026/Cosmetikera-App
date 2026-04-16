import { NextResponse, type NextRequest } from "next/server";
import { CookieOptions, createServerClient } from "@supabase/ssr";

type SupabaseCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const pendingCookies: SupabaseCookie[] = [];

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase environment variables are not configured");
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookies: SupabaseCookie[]) {
            pendingCookies.push(...cookies);
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(
      url.toString()
    );

    // Always redirect to home (or / after successful exchange)
    const redirectTo = url.searchParams.get("redirect") || "/";

    if (error) {
      const response = NextResponse.redirect(url.origin + "/login?error=oauth");
      pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
      response.headers.set("x-auth-error", error.message);
      return response;
    }

    const { data: userData } = await supabase.auth.getUser();
    const authEmail = (userData?.user?.email || "").toLowerCase();
    const authUserId = userData?.user?.id || "";

    let emailOk = false;
    if (authUserId && authEmail) {
      const { data: perfiles } = await supabase
        .from("perfiles")
        .select("id, email")
        .ilike("email", authEmail)
        .limit(2);

      if (perfiles && perfiles.length === 1) {
        const perfil = perfiles[0]!;
        const perfilEmail = (perfil.email || "").toLowerCase();
        const sameIdentity = perfil.id === authUserId;
        emailOk = Boolean(perfilEmail && perfilEmail === authEmail && sameIdentity);

        if (!sameIdentity) {
          await supabase.auth.signOut();
          const response = NextResponse.redirect(url.origin + "/login?error=cuenta-existente");
          pendingCookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          return response;
        }
      } else {
        emailOk = false;
      }
    }

    if (!emailOk) {
      await supabase.auth.signOut();
      const response = NextResponse.redirect(url.origin + "/login?error=email-no-registrado");
      pendingCookies.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
      return response;
    }

    const response = NextResponse.redirect(url.origin + redirectTo);

    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });

    return response;
  } catch (e: any) {
    // Fallback redirect
    return NextResponse.redirect(new URL("/", request.url));
  }
}
