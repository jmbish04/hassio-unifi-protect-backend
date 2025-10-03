export interface Env {
  // Database
  DB: D1Database;

  // Storage
  BUCKET: R2Bucket;

  // AI
  AI: any; // Workers AI binding

  // Queue
  EVENTS_Q: Queue;

  // Static Assets
  ASSETS: Fetcher;

  // Home Assistant
  HA_BASE_URL?: string;
  HA_TOKEN?: string;
  HA_VISION_SERVICE?: string;

  // Protect API
  PROTECT_API: string;
  PROTECT_API_KEY: string;
  UNIFI_USERNAME: string;
  UNIFI_PASSWORD: string;
  ACCESS_CLIENT_ID?: string;
  ACCESS_CLIENT_SECRET?: string;

  // Worker API
  WORKER_API_KEY: string;

  // Notifications
  NTFY_TOPIC_URL?: string;
}

export interface SecuritySweepOptions {
  trigger?: string;
  focusCamera?: string | null;
}

export interface SecuritySweepResult {
  runId: string;
  ts: number;
  trigger: string;
  summary: string;
  observations: Observation[];
}

export interface Observation {
  camera: string;
  rule: string;
  result: 'pass' | 'warn' | 'fail';
}

export interface RuleResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
}

export interface HAState {
  state: string;
  attributes?: Record<string, any>;
  last_changed?: string;
  last_updated?: string;
}

export interface HAStates {
  [entityId: string]: HAState | null;
}

export interface VisionAnalysis {
  description?: string;
  objects?: string[];
  confidence?: number;
  [key: string]: any;
}

export interface SnapshotResult {
  bytes: Uint8Array;
  r2Key: string;
}

export interface PatrolRun {
  id: string;
  ts: number;
  trigger: string;
  summary: string;
}

export interface ObservationRecord {
  run_id: string;
  camera: string;
  rule: string;
  result: string;
  details: string;
  r2_key: string;
}

export interface WebhookEvent {
  type: string;
  camera?: string;
  [key: string]: any;
}

export interface MessageBatch<T = any> {
  messages: Array<{
    id: string;
    timestamp: Date;
    body: T;
    ack(): void;
    retry(): void;
  }>;
}

// UniFi Protect API Types
export interface ProtectCamera {
  id: string;
  host: string;
  connectionHost: string;
  lastSeen: string;
  isPoorNetwork: boolean;
  lastRing: string;
  videoCodec: string;
  wiredConnectionState: Record<string, any>;
  wifiConnectionState: Record<string, any>;
  talkbackSettings: Record<string, any>;
  speakerSettings: Record<string, any>;
  smartDetectSettings: {
    objectTypes: string[];
    autoTrackingObjectTypes: string[];
    autoTrackingWithZoom: boolean;
    audioTypes: string[];
    detectionRanges: any[];
  };
  motionZones: any[];
  smartDetectZones: any[];
  name: string;
  mac: string;
  type: string;
  state: string;
  isRecording: boolean;
  channels: ProtectChannel[];
}

export interface ProtectChannel {
  name: string;
  isRtspEnabled: boolean;
  rtspAlias: string;
}

export interface ProtectStream {
  name: string;
  enabled: boolean;
  url: string;
}

export interface ProtectBootstrapData {
  cameras: ProtectCamera[];
  [key: string]: any;
}

export interface ProtectLoginResponse {
  message: string;
  status: string;
}

export interface ProtectCamerasResponse {
  cameras: ProtectCamera[];
}

export interface ProtectCameraResponse extends ProtectCamera {}

export interface ProtectStreamsResponse {
  streams: ProtectStream[];
}
