import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/portal/Brand";
import { LoginForm } from "@/components/portal/AuthForms";
import { getSessionUser } from "@/auth/request";
import { checkAccess, HOME } from "@/auth/guard";

export const metadata = { title: "Staff sign in · ArenaHub" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user && checkAccess(user, "staff") === "ok") redirect(HOME[user.role]);
  return (
    <main className="lg">
      <div className="lgc">
        <Brand />
        <h1>Staff sign in</h1>
        <p>For the Admin and PICs. Your role is detected from your account.</p>
        <LoginForm />
        <Link className="btn s" href="/">Back to public website</Link>
      </div>
    </main>
  );
}
