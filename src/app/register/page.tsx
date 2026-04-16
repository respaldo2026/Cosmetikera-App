import { redirect } from "next/navigation";

export default async function Register() {
  // Redirigir a login porque solo se pueden registrar usuarios
  // que hayan pagado o que sean creados por directivos desde la app
  redirect("/login");
}

