import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Library", template: "%s · Library" },
  description: "Studies, reports, and articles your organization found useful, each with a checked summary.",
  robots: { index: false, follow: false },
};

/**
 * Sets the class `dark` before the page paints, as `useThemePreference` of
 * `src/components/ui/theme.ts` will (same storage key), so dark mode does not
 * flash light on load.
 */
const THEME_SCRIPT = `(function(){var t;try{t=localStorage.getItem("library.theme")}catch(e){}var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)})()`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every page renders per request: the CSP nonce is new for each response,
  // and almost every page depends on the session.
  await connection();
  // Set by src/proxy.ts with the Content Security Policy.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    // The theme script changes the class before React hydrates.
    <html lang="en-US" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
