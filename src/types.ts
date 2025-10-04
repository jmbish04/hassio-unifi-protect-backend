export interface WebhookEvent {
	eventId: string;
	cameraId: string;
	eventType: string;
	timestamp: string;
	thumbnail?: string; // base64 encoded
	rawPayload: any;
	type?: string; // Optional type field for compatibility
}

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

	// FastAPI Proxy
	FASTAPI_PROXY_URL: string;

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

// Log Entry Types
export interface LogEntry {
	logId: string;
	timestamp: string;
	level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
	loggerName?: string;
	message: string;
	module?: string;
	functionName?: string;
	lineNumber?: number;
	threadId?: string;
	processId?: number;
	extraData?: Record<string, any>;
	sourceIp?: string;
	userAgent?: string;
	requestId?: string;
	correlationId?: string;
}

export interface LogEntryRequest {
	level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
	loggerName?: string;
	message: string;
	module?: string;
	functionName?: string;
	lineNumber?: number;
	threadId?: string;
	processId?: number;
	extraData?: Record<string, any>;
	requestId?: string;
	correlationId?: string;
}

export interface LogEntriesResponse {
	success: boolean;
	message: string;
	logId?: string;
	count?: number;
	entries?: LogEntry[];
}

// Unit Test Types
export interface UnitTestSession {
	id: number;
	session_id: string;
	timestamp_start: string;
	timestamp_completed?: string;
	status: 'running' | 'completed' | 'failed' | 'cancelled';
	total_tests?: number;
	completed_tests?: number;
	failed_tests?: number;
	created_at: string;
	updated_at: string;
}

export interface UnitTestResult {
	id: number;
	session_id: string;
	test_name: string;
	test_category?: string;
	timestamp_start: string;
	timestamp_completed?: string;
	status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'error';
	test_results?: string;
	error_message?: string;
	duration_ms?: number;
	created_at: string;
	updated_at: string;
}
