import type { Env, PatrolRun, ObservationRecord } from '../types.js';

export class StorageService {
  constructor(private env: Env) {}

  async saveRun(run: PatrolRun): Promise<void> {
    await this.env.DB.prepare(
      "INSERT INTO patrol_runs (id, trigger_source, started_at, summary) VALUES (?, ?, ?, ?)"
    ).bind(run.id, run.trigger, run.ts, run.summary).run();
  }

  async saveObservation(observation: ObservationRecord): Promise<void> {
    await this.env.DB.prepare(
      "INSERT OR REPLACE INTO observations (run_id, camera, rule, result, details, r2_key) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(
      observation.run_id,
      observation.camera,
      observation.rule,
      observation.result,
      observation.details,
      observation.r2_key
    ).run();
  }
}
