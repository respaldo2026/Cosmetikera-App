import { AuthPage } from "@components/auth-page";
import { LoginLanding } from "@components/auth-page/LoginLanding";
import { authProviderServer } from "../../providers/auth-provider/auth-provider.server";
import { redirect } from "next/navigation";

export default async function Login() {
  const data = await getData();

  if (data.authenticated) {
    redirect(data?.redirectTo || "/");
  }

  return (
    <LoginLanding>
      <AuthPage type="login" />
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
