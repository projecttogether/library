import { Page } from "@/components/ui/page";
import { cookies } from "next/headers";
import { LibraryFrame } from "@/components/library-frame";
import { canAdminister, canMaintain } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { countMyDrafts, countMaintenanceWork } from "@/lib/library/review";

/** Set by the frame's sidebar when it is opened or hidden. */
const SIDEBAR_COOKIE = "sidebar_state";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { person } = await requireUser();
  const [cookieStore, drafts, maintenanceWork] = await Promise.all([
    cookies(),
    countMyDrafts(getDb(), person.id),
    canMaintain(person.role) ? countMaintenanceWork(getDb()) : Promise.resolve(0),
  ]);
  return (
    <LibraryFrame
      user={{ name: person.displayName, email: person.workEmail }}
      canMaintain={canMaintain(person.role)}
      canAdminister={canAdminister(person.role)}
      badges={{ review: drafts, maintenance: maintenanceWork }}
      defaultSidebarOpen={cookieStore.get(SIDEBAR_COOKIE)?.value !== "false"}
    >
      {/* The library's reading width: notes are mostly text. */}
      <Page className="max-w-5xl">{children}</Page>
    </LibraryFrame>
  );
}
