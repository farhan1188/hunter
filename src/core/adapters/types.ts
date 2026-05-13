import type { JobPosting, AdapterName } from "../types";

export type AdapterConfig = Record<string, unknown>;

export interface Adapter {
  name: AdapterName;

  /** Validate the user-provided config (e.g. company tokens for Greenhouse). */
  validateConfig(config: AdapterConfig): void;

  /**
   * Fetch new postings. Returns normalized JobPostings.
   * The adapter is responsible for parsing/normalizing only — dedupe and persistence
   * happen in the Ingest routine.
   */
  fetch(config: AdapterConfig): Promise<JobPosting[]>;
}
