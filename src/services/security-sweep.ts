import type { Env, SecuritySweepOptions, SecuritySweepResult, Observation } from '../types.js';
import { HomeAssistantClient } from '../integrations/homeassistant.js';
import { VisionAnalysisService } from './vision.js';
import { CameraService } from './camera.js';
import { RulesEngine } from './rules.js';
import { StorageService } from './storage.js';
import { NotificationService } from './notifications.js';

export class SecuritySweepService {
  private haClient: HomeAssistantClient;
  private visionService: VisionAnalysisService;
  private cameraService: CameraService;
  private rulesEngine: RulesEngine;
  private storageService: StorageService;
  private notificationService: NotificationService;

  constructor(private env: Env) {
    this.haClient = new HomeAssistantClient(env);
    this.visionService = new VisionAnalysisService(env);
    this.cameraService = new CameraService(env);
    this.rulesEngine = new RulesEngine();
    this.storageService = new StorageService(env);
    this.notificationService = new NotificationService(env);
  }

  async runSecuritySweep(options: SecuritySweepOptions = {}): Promise<SecuritySweepResult> {
    const { trigger = "unknown", focusCamera = null } = options;
    const runId = crypto.randomUUID();
    const ts = Date.now();

    try {
      // 1) read HA states we care about (with error handling)
      let haStates = {};
      try {
        haStates = await this.haClient.getStates([
          "binary_sensor.garage_door",
          "device_tracker.car_justin",     // adjust to your entities
          "lock.front_door",
          "binary_sensor.driveway_motion",
        ]);
      } catch (error) {
        console.warn('Failed to fetch HA states:', error);
        // Continue with empty states
      }

      // 2) per-camera snapshots + vision analysis (with error handling)
      const selectedCameras = this.cameraService.getSelectedCameras(focusCamera);
      const observations: Observation[] = [];

      for (const camera of selectedCameras) {
        try {
          const { bytes, r2Key } = await this.cameraService.fetchAndStoreSnapshot(camera, runId, ts);

          const vision = await this.visionService.analyzeImage(bytes, camera);

          // simple rules — tune these for your property
          const rules = this.rulesEngine.evaluateRules({ haStates, cam: camera, vision });

          for (const rule of rules) {
            await this.storageService.saveObservation({
              run_id: runId,
              camera,
              rule: rule.name,
              result: rule.status,
              details: JSON.stringify({ vision, haStates }),
              r2_key: r2Key,
            });
            observations.push({ camera, rule: rule.name, result: rule.status });
          }
        } catch (error) {
          console.warn(`Failed to process camera ${camera}:`, error);
          // Add a failed observation for this camera
          observations.push({
            camera,
            rule: 'camera_processing',
            result: 'fail'
          });
        }
      }

      // 3) derive summary + write patrol run
      const summary = this.rulesEngine.summarise(observations, haStates);
      try {
        await this.storageService.saveRun({ id: runId, ts, trigger, summary });
      } catch (error) {
        console.warn('Failed to save patrol run:', error);
      }

      // 4) set HA input_booleans (example: car_and_door_open)
      try {
        const booleans = this.rulesEngine.computeBooleans(observations, haStates);
        await this.haClient.setInputBooleans(booleans).catch(() => {});
      } catch (error) {
        console.warn('Failed to set HA booleans:', error);
      }

      // 5) optional ntfy alert if anything flagged
      if (observations.some(o => o.result === "fail" || o.result === "warn")) {
        await this.notificationService.sendNtfy(`SecurityPatrol: ${summary}`).catch(() => {});
      }

      return { runId, ts, trigger, summary, observations };
    } catch (error) {
      console.error('Security sweep failed:', error);
      // Return a basic result even if everything fails
      return {
        runId,
        ts,
        trigger,
        summary: `Security sweep completed with errors: ${error instanceof Error ? error.message : 'Unknown error'}`,
        observations: []
      };
    }
  }
}
