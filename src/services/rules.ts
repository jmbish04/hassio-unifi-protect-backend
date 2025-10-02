import type { HAStates, VisionAnalysis, RuleResult, Observation } from '../types.js';
import { onOff } from '../integrations/homeassistant.js';

export class RulesEngine {
  evaluateRules({ haStates, cam, vision }: {
    haStates: HAStates;
    cam: string;
    vision: VisionAnalysis | null;
  }): RuleResult[] {
    // read HA states
    const garageOpen = onOff(haStates["binary_sensor.garage_door"]) === "on";
    const carHome = onOff(haStates["device_tracker.car_justin"]) === "home";
    const frontLocked = onOff(haStates["lock.front_door"]) === "locked";

    // naive parsing of vision text/json — adapt to your model output
    const vtxt = JSON.stringify(vision || "").toLowerCase();
    const person = vtxt.includes("person") || vtxt.includes("human");
    const vehicle = vtxt.includes("car") || vtxt.includes("vehicle");
    const doorOpenInImg = vtxt.includes("door open");

    const rules: RuleResult[] = [];

    // Example rule: car present + garage door open → WARN/FAIL
    if (vehicle && garageOpen) {
      rules.push({ name: "car_and_door_open", status: "warn" });
    }

    // Example rule: person detected at night on driveway cam
    const hours = new Date().getHours();
    if (person && (hours >= 22 || hours <= 5) && /driveway|front/.test(cam)) {
      rules.push({ name: "person_at_night", status: "fail" });
    }

    // Example rule: front door appears open but lock says locked -> warn
    if (doorOpenInImg && frontLocked) {
      rules.push({ name: "visual_door_open_but_locked", status: "warn" });
    }

    if (rules.length === 0) {
      rules.push({ name: "baseline", status: "pass" });
    }

    return rules;
  }

  summarise(obs: Observation[], ha: HAStates): string {
    const fails = obs.filter(o => o.result === "fail").map(o => `${o.camera}:${o.rule}`);
    const warns = obs.filter(o => o.result === "warn").map(o => `${o.camera}:${o.rule}`);

    if (fails.length) {
      return `FAIL ${fails.join(", ")}; warns: ${warns.join(", ") || "none"}`;
    }
    if (warns.length) {
      return `WARN ${warns.join(", ")}`;
    }
    return "All clear";
  }

  computeBooleans(obs: Observation[], ha: HAStates): Record<string, boolean> {
    const carDoor = obs.some(o =>
      o.rule === "car_and_door_open" &&
      (o.result === "warn" || o.result === "fail")
    );

    return {
      "input_boolean.car_and_door_open": carDoor,
    };
  }
}
