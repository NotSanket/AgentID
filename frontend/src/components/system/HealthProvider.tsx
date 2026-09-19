import { createContext, useContext, type ReactNode } from "react";
import { useHealth } from "../../hooks/useHealth";

type HealthContextValue = ReturnType<typeof useHealth>;
const HealthContext = createContext<HealthContextValue | null>(null);

export function HealthProvider({ children }: { children: ReactNode }) {
  const health = useHealth();
  return <HealthContext.Provider value={health}>{children}</HealthContext.Provider>;
}

export function useSystemHealth() {
  const value = useContext(HealthContext);
  if (!value) throw new Error("useSystemHealth must be used inside HealthProvider.");
  return value;
}
