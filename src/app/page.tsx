import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isDevAuthBypassEnabled } from "@/utils/auth/dev-bypass";
import VistaRapidaClient from "./VistaRapidaClient";

export default async function VistaRapidaPage() {
  if (!isDevAuthBypassEnabled) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      redirect("/login");
    }
  }

  return <VistaRapidaClient />;
}