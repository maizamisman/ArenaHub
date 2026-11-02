import { redirect } from "next/navigation";
import { Brand } from "@/components/portal/Brand";
import { ChangePasswordForm } from "@/components/portal/AuthForms";
import { getSessionUser } from "@/auth/request";
import { logoutAction } from "../actions/auth";

export const metadata = { title: "Change password · ArenaHub" };

export default async function ChangePasswordPage() {
  const user = await getSessionUser();
  if (!user) redirect("/staff/login");
  if (user.role === "admin" && !user.mfaOk) redirect("/staff/2fa");
  return (
    <main className="lg">
      <div className="lgc">
        <Brand />
        <h1>{user.mustChange ? "Choose your own password" : "Change password"}</h1>
        <p>{user.mustChange ? `Welcome, ${user.name}. Replace the temporary password from the Admin before you continue.` : "Enter your current password, then the new one twice."}</p>
        <ChangePasswordForm />
        <form action={logoutAction}><button className="btn s" type="submit" style={{ width: "100%" }}>Sign out</button></form>
      </div>
    </main>
  );
}
