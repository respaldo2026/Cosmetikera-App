import { AuthPage } from "@components/auth-page";
import { LoginLanding } from "@components/auth-page/LoginLanding";
import { authProviderServer } from "../../providers/auth-provider/auth-provider.server";
import { redirect } from "next/navigation";
import Link from "next/link";

type LoginPageProps = {
  searchParams?: Promise<{ from?: string }>;
};

export default async function Login({ searchParams }: LoginPageProps) {
  const data = await getData();
  const params = await searchParams;
  const isClubAudience = params?.from === "club";

  if (data.authenticated) {
    redirect(data?.redirectTo || "/");
  }

  return (
    <LoginLanding audience={isClubAudience ? "club" : "admin"}>
      <div style={{ display: "grid", gap: 12 }}>
        <AuthPage type="login" audience={isClubAudience ? "club" : "admin"} />
        {!isClubAudience ? (
          <p style={{ textAlign: "center", margin: 0, fontSize: 13 }}>
            ¿Aún no tienes tienda? <Link href="/onboarding">Crear mi tienda</Link>
          </p>
        ) : null}
      </div>
    </LoginLanding>
  );
}

async function getData() {
  const { authenticated, redirectTo, error } = await authProviderServer.check();

  return {
    authenticated,
    redirectTo,
    error,
  };
}
