"use client";

import { AppFrame, type NavGroup } from "@/components/ui/app-frame";
import { useThemePreference } from "@/components/ui/theme";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOutAction } from "@/app/actions";
import { APP_NAME, AppIcon, SidebarOrganization } from "@/components/brand";
import { findNotes, libraryHref } from "@/lib/library/search";
import { breadcrumbsFor, navSections, type NavKey } from "@/lib/navigation";

interface LibraryFrameProps {
  user: { name: string; email: string | null };
  /** Shows the Maintenance group: maintainers and admins. */
  canMaintain: boolean;
  /** Shows the Administration group: admins. */
  canAdminister: boolean;
  /** Shown as a count next to an item: things waiting for the person. */
  badges: Partial<Record<NavKey, number>>;
  /** The cookie `sidebar_state`, read on the server. */
  defaultSidebarOpen: boolean;
  children: React.ReactNode;
}

const search = { find: findNotes, allResultsHref: libraryHref };

function waiting(count: number | undefined): React.ReactNode {
  if (!count) return undefined;
  return (
    <>
      {count}
      <span className="sr-only"> waiting</span>
    </>
  );
}

/**
 * The app frame (`src/components/ui/app-frame.tsx`) with the library's navigation: a client
 * component, because the frame takes the router's link and functions, which
 * cannot come from the server layout.
 */
export function LibraryFrame({
  user,
  canMaintain,
  canAdminister,
  badges,
  defaultSidebarOpen,
  children,
}: LibraryFrameProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useThemePreference();
  const nav: NavGroup[] = navSections({ canMaintain, canAdminister }).map((section) => ({
    label: section.label,
    items: section.items.map(({ key, href, label, shortcut, match }) => ({
      href,
      label,
      shortcut,
      match,
      badge: waiting(badges[key]),
    })),
  }));

  return (
    <AppFrame
      app={{ name: APP_NAME, icon: <AppIcon />, description: "Shared reading" }}
      nav={nav}
      sidebarFooter={<SidebarOrganization />}
      pathname={pathname}
      link={Link}
      navigate={(href) => router.push(href)}
      user={user}
      theme={theme}
      onThemeChange={setTheme}
      settingsHref="/settings"
      onSignOut={() => void signOutAction()}
      breadcrumbs={breadcrumbsFor(pathname)}
      search={search}
      defaultSidebarOpen={defaultSidebarOpen}
    >
      {children}
    </AppFrame>
  );
}
