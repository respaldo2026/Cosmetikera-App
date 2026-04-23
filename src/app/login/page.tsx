import { AuthPage } from "@components/auth-page";
import { LoginLanding } from "@components/auth-page/LoginLanding";
import { authProviderServer } from "../../providers/auth-provider/auth-provider.server";
import { redirect } from "next/navigation";

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
      <AuthPage type="login" audience={isClubAudience ? "club" : "admin"} />
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
