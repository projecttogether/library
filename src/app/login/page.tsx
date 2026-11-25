import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SignInPage } from "@/components/ui/sign-in-page";
import { LogIn } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signInAction } from "@/app/actions";
import { APP_NAME, AppIcon, MadeBy } from "@/components/brand";
import { NO_ACCESS_ERROR_CODE } from "@/lib/auth/access";
import { hasSession } from "@/lib/auth/session";
import { getAuthConfig } from "@/lib/config";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  if (error === NO_ACCESS_ERROR_CODE) redirect("/no-access");
  if (await hasSession()) redirect("/");
  const provider = getAuthConfig().OIDC_PROVIDER_NAME;

  return (
    <SignInPage
      app={{ name: APP_NAME, icon: <AppIcon className="size-9" /> }}
      tagline="Studies, reports, and articles your colleagues found useful, each with a checked summary."
      footer={<MadeBy />}
      description="Use the account of your organization."
    >
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Sign-in failed</AlertTitle>
          <AlertDescription>
            Please try again. If it keeps failing, contact your administrator.
          </AlertDescription>
        </Alert>
      ) : null}
      <form action={signInAction}>
        <Button type="submit" size="lg" className="w-full">
          <LogIn aria-hidden="true" />
          {provider ? `Sign in with ${provider}` : "Sign in"}
        </Button>
      </form>
    </SignInPage>
  );
}
