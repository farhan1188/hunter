import type { Adapter } from "./types";
import type { AdapterName } from "../types";
import { RemoteOKAdapter } from "./remoteok";
import { HoneypotAdapter } from "./honeypot";
import { GreenhouseAdapter } from "./greenhouse";
import { LeverAdapter } from "./lever";
import { AshbyAdapter } from "./ashby";
import { HimalayasAdapter } from "./himalayas";
import { JobicyAdapter } from "./jobicy";
import { WorkingNomadsAdapter } from "./workingnomads";
import { WeWorkRemotelyAdapter } from "./weworkremotely";

/**
 * Adapter registry. Add new adapters here as you implement them.
 * Routines look adapters up by name from the Turso `adapters` table's `enabled=true` rows.
 */
const ADAPTERS: Partial<Record<AdapterName, Adapter>> = {
  remoteok: new RemoteOKAdapter(),
  honeypot: new HoneypotAdapter(),
  greenhouse: new GreenhouseAdapter(),
  lever: new LeverAdapter(),
  ashby: new AshbyAdapter(),
  himalayas: new HimalayasAdapter(),
  jobicy: new JobicyAdapter(),
  workingnomads: new WorkingNomadsAdapter(),
  weworkremotely: new WeWorkRemotelyAdapter(),
};

export function getAdapter(name: AdapterName): Adapter | undefined {
  return ADAPTERS[name];
}

export function getRegisteredAdapterNames(): AdapterName[] {
  return Object.keys(ADAPTERS) as AdapterName[];
}
