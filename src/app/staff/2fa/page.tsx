import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import QRCode from "qrcode";
import { Brand } from "@/components/portal/Brand";
import { MfaForm, SetupSecret } from "@/components/portal/AuthForms";
import { getSessionUser } from "@/auth/request";
import { totpSecretFor } from "@/auth/session";
import { newTotpSecret, otpauthUrl } from "@/auth/totp";
import { HOME } from "@/auth/guard";
import { logoutAction } from "../actions/auth";

export const metadata = { title: "Two-step check · ArenaHub" };

export default async function TwoFactorPage() {
  const user = await getSessionUser();
  if (!user) redirect("/staff/login");
  if (user.role !== "admin" || user.mfaOk) redirect(user.mustChange ? "/staff/change-password" : HOME[user.role]);

  const configured = !!totpSecretFor(user.id);
  // First sign-in: a fresh secret is held in a short-lived cookie until a code confirms it.
  const pending = configured ? null : (await cookies()).get("ah_totp_setup")?.value ?? newTotpSecret();
  const qr = pending ? await QRCode.toDataURL(otpauthUrl(pending, user.email), { margin: 1, width: 200 }) : null;

  return (
    <main className="lg">
      <div className="lgc">
        <Brand />
        <h1>{configured ? "Enter your code" : "Set up two-step sign in"}</h1>
        {configured ? (
          <p>Open your authenticator app and enter the 6-digit code for ArenaHub.</p>
        ) : (
          <>
            <p>The Admin account needs an authenticator app such as Google Authenticator or Microsoft Authenticator. Scan this code, or type the key, then enter the 6-digit code it shows.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="qr" src={qr!} alt="QR code for the authenticator app" width={200} height={200} />
            <SetupSecret secret={pending!} />
          </>
        )}
        <MfaForm />
        <form action={logoutAction}><button className="btn s" type="submit" style={{ width: "100%" }}>Sign out</button></form>
      </div>
    </main>
  );
}
