"use client";

import { createContext, useContext } from "react";

type RoleContextValue = {
  role: string | null;
};

const RoleContext = createContext<RoleContextValue>({ role: null });

export function RoleProvider({ role, children }: { role: string | null; children: React.ReactNode }) {
  return <RoleContext.Provider value={{ role }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}
