/**
 * The tab to mark in the tab bar and the top bar: where the learner is going
 * while a move is under way, else where they are. The tap shows at once,
 * before the next page has loaded (`lib/nav.ts` decides which tab a path
 * belongs to).
 */
import { useLocation, useNavigation } from "react-router";

import { activeTab, type SiteTabId } from "~/lib/nav";

export function useActiveTab(): SiteTabId | null {
  const { pathname } = useLocation();
  const navigation = useNavigation();
  return activeTab(navigation.location?.pathname ?? pathname);
}
