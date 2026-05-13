import type { Adapter } from "./types";
import type { AdapterName } from "../types";
import { RemoteOKAdapter } from "./remoteok";

/**
 * Adapter registry. Add new adapters here as you implement them.
 * Routines look adapters up by name from the Turso `adapters` table's `enabled=true` rows.
 */
const ADAPTERS: Partial<Record<AdapterName, Adapter>> = {
  remoteok: new RemoteOKAdapter(),
};

export function getAdapter(name: AdapterName): Adapter | undefined {
  return ADAPTERS[name];
}

export function getRegisteredAdapterNames(): AdapterName[] {
  return Object.keys(ADAPTERS) as AdapterName[];
}
