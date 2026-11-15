import type { SidebarMode, SidebarTab } from "./SidebarLeft.js";

export const SIDEBAR_MODE_KEY = "bwjm:sidebar-mode";
export const SIDEBAR_TAB_KEY = "bwjm:sidebar-tab";

export function normalizeSidebarMode(value: string | null): SidebarMode {
  return value === "expanded" || value === "collapsed" || value === "hidden" ? value : "expanded";
}

export function normalizeSidebarTab(value: string | null): SidebarTab {
  return value === "variables" || value === "inspector" ? value : "outline";
}

export function readSidebarPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function saveSidebarPreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The editor must remain usable even when browser storage is restricted.
  }
}
