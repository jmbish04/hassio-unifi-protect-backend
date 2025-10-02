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

    // 1) read HA states we care about
    const haStates = await this.haClient.getStates([
      "binary_sensor.garage_door",
      "device_tracker.car_justin",     // adjust to your entities
      "lock.front_door",
      "binary_sensor.driveway_motion",
    ]);

    // 2) per-camera snapshots + vision analysis
    const selectedCameras = this.cameraService.getSelectedCameras(focusCamera);
    const observations: Observation[] = [];

    for (const camera of selectedCameras) {
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
    }

    // 3) derive summary + write patrol run
    const summary = this.rulesEngine.summarise(observations, haStates);
    await this.storageService.saveRun({ id: runId, ts, trigger, summary });

    // 4) set HA input_booleans (example: car_and_door_open)
    const booleans = this.rulesEngine.computeBooleans(observations, haStates);
    await this.haClient.setInputBooleans(booleans).catch(() => {});

    // 5) optional ntfy alert if anything flagged
    if (observations.some(o => o.result === "fail" || o.result === "warn")) {
      await this.notificationService.sendNtfy(`SecurityPatrol: ${summary}`).catch(() => {});
    }

    return { runId, ts, trigger, summary, observations };
  }
}
