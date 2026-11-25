import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import organizationLogo from "@/assets/projecttogether-logo.png";
import { cn } from "@/components/ui/utils";
import { REPOSITORY_URL } from "@/lib/repository";

/*
 * The app's identity (ProjectTogether's app identity rules): its own icon,
 * Lucide's library on PT Sky (src/app/icon.svg), in the browser tab, the
 * sidebar and on the sign-in page; ProjectTogether's unchanged logo as the
 * organization that makes the app, in the sidebar's footer, on the sign-in
 * page and in the About card. Server and client components both use these.
 */

/** The app's name. */
export const APP_NAME = "Library";

/** The organization that makes the app. */
export const ORGANIZATION = "ProjectTogether";

/** The paths of Lucide's library icon (24 × 24), as in src/app/icon.svg. */
const LIBRARY_PATHS = ["m16 6 4 14", "M12 6v14", "M8 8v12", "M4 4v16"];

/**
 * The app icon; 32 pixels unless `className` sets another size. The drawing
 * sits in a span, so that menus that size their own icons leave it alone.
 */
export function AppIcon({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex size-8 shrink-0", className)}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true" className="size-full">
        <rect width="32" height="32" rx="8" fill="#008ce6" />
        <g
          transform="translate(4 4)"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {LIBRARY_PATHS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </svg>
    </span>
  );
}

/** ProjectTogether's logo; 20 pixels unless `className` sets another size. */
export function OrganizationLogo({ className }: { className?: string }) {
  return (
    <Image
      src={organizationLogo}
      alt=""
      width={20}
      height={20}
      unoptimized
      className={cn("size-5 shrink-0 rounded-sm", className)}
    />
  );
}

/** The sidebar's footer: the organization's logo and name. */
export function SidebarOrganization() {
  return (
    <div className="text-muted-foreground flex items-center gap-2 px-2 text-xs">
      <OrganizationLogo />
      <span className="truncate">{ORGANIZATION}</span>
    </div>
  );
}

/** "Library is open source, made by ProjectTogether. Source code", with the logo (sign-in page). */
export function MadeBy() {
  return (
    <span className="inline-flex items-center gap-2">
      <OrganizationLogo className="size-6" />
      <span>
        {APP_NAME} is open source, made by {ORGANIZATION}.{" "}
        <a
          href={REPOSITORY_URL}
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground inline-flex items-center gap-0.5 underline underline-offset-4"
        >
          Source code
          <ArrowUpRight className="size-3" aria-hidden="true" />
          <span className="sr-only">(GitHub, opens in a new tab)</span>
        </a>
      </span>
    </span>
  );
}
