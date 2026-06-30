import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { isDevAuthBypassEnabled } from "@/utils/auth/dev-bypass";
import { shouldRedirectToTenantOnboarding } from "@/utils/tenant/server-onboarding";
import VistaRapidaClient from "./VistaRapidaClient";

export default async function VistaRapidaPage() {
  const cookieStore = await cookies();
  const headerStore = await headers();

  if (!isDevAuthBypassEnabled) {
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
      const onboardingState = await shouldRedirectToTenantOnboarding({
        pathname: "/",
        host: headerStore.get("x-forwarded-host") || headerStore.get("host"),
        cookieTenant: cookieStore.get("lc_tenant")?.value,
      });

      if (onboardingState.shouldRedirect) {
        redirect(`/onboarding?tenantSlug=${encodeURIComponent(onboardingState.tenantSlug)}`);
      }

      redirect("/login");
    }
  }

  return <VistaRapidaClient />;
}