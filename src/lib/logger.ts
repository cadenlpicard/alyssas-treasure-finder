import { Logger } from "tslog";

// Global application logger
export const appLogger = new Logger({
  name: "AlyssasTreasureFinder",
});

// Create namespaced sub loggers for components/features
export const createLogger = (name: string) => appLogger.getSubLogger({ name });

// Optional: expose on window for quick debugging in the browser console

if (typeof window !== "undefined") (window as any).appLogger = appLogger;
