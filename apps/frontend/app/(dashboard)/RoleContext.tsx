"use client";

import { createContext, useContext } from "react";

type RoleContextValue = {
  role: string | null;
  // The plan banner (Records/Devices/Sources counts, usage limits) lives in the dashboard layout,
  // one level up from every page - a page that changes one of those counts (deleting records,
  // etc.) calls this to refresh it immediately instead of leaving it stale until the next
  // navigation or a manual page reload.
  refreshPlan: () => void;
};

const RoleContext = createContext<RoleContextValue>({ role: null, refreshPlan: () => {} });

export function RoleProvider({
  role,
  refreshPlan,
  children
}: {
  role: string | null;
  refreshPlan: () => void;
  children: React.ReactNode;
}) {
  return <RoleContext.Provider value={{ role, refreshPlan }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}
