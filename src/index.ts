import type { Env, WebhookEvent, LogEntryRequest } from './types.js';
import { SecuritySweepService } from './services/security-sweep.js';
import { ProtectApiService } from './services/protect-api.js';
import { WebhookHandlerService } from './services/webhook-handler.js';
import { LogService } from './services/log-service.js';
import { UnitTestService } from './services/unit-test-service.js';
import { WorkerSelfTestService } from './services/worker-self-test.js';
import { json } from './utils/response.js';

export default {
	// HTTP endpoints
	async fetch(req: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(req.url);

		// UI Worker Agent Prompt endpoint (must be before static assets handler)
		if (url.pathname === '/ui/worker-agent-prompt' && req.method === 'GET') {
			try {
				const promptFile = await env.ASSETS.fetch(new Request(new URL('/UNIT_TEST_AGENT_PROMPT.md', req.url)));

				if (!promptFile.ok) {
					return new Response(JSON.stringify({ error: 'Worker agent prompt file not found' }), {
						status: 404,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				const content = await promptFile.text();

				return new Response(content, {
					headers: {
						'Content-Type': 'text/plain; charset=utf-8',
						'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
						'Access-Control-Allow-Origin': '*',
					},
				});
			} catch (error) {
				console.error('Error serving worker agent prompt:', error);
				return new Response(
					JSON.stringify({
						error: 'Failed to serve worker agent prompt',
						details: error instanceof Error ? error.message : String(error),
					}),
					{ status: 500, headers: { 'Content-Type': 'application/json' } },
				);
			}
		}

		// Handle static assets first
		if (
			url.pathname.startsWith('/public/') ||
			url.pathname === '/' ||
			url.pathname === '/index.html' ||
			url.pathname === '/openapi.json' ||
			url.pathname === '/favicon.ico'
		) {
			try {
				// For root path, serve index.html
				if (url.pathname === '/') {
					const indexRequest = new Request(new URL('/index.html', req.url));
					return await env.ASSETS.fetch(indexRequest);
				}
				// For favicon, return a simple 204 No Content response
				if (url.pathname === '/favicon.ico') {
					return new Response(null, { status: 204 });
				}
				// Serve other static assets
				return await env.ASSETS.fetch(req);
			} catch (error) {
				console.error('Error serving static asset:', error);
				return new Response('Asset not found', { status: 404 });
			}
		}

		if (url.pathname === '/agent/security_sweep') {
			// API-triggered on-demand sweep (GET or POST)
			const focus = url.searchParams.get('camera');
			const securitySweep = new SecuritySweepService(env);
			const result = await securitySweep.runSecuritySweep({
				trigger: 'api',
				focusCamera: focus,
			});
			return json(result);
		}

		// UniFi Protect API endpoints
		if (url.pathname === '/protect/login' && req.method === 'POST') {
			try {
				const protectApi = new ProtectApiService(env);
				const result = await protectApi.login();
				return json(result);
			} catch (error) {
				return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Login failed' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		}

		if (url.pathname === '/protect/cameras' && req.method === 'GET') {
			// Validate API key
			const apiKey = req.headers.get('x-api-key');
			if (!apiKey) {
				return new Response(JSON.stringify({ error: 'API key required' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			try {
				const protectApi = new ProtectApiService(env);
				if (!protectApi.validateApiKey(apiKey)) {
					return new Response(JSON.stringify({ error: 'Invalid API key' }), {
						status: 401,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				const cameras = await protectApi.getCameras();
				return json({ cameras });
			} catch (error) {
				return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch cameras' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		}

		if (url.pathname.startsWith('/protect/cameras/') && url.pathname.endsWith('/streams') && req.method === 'GET') {
			// Validate API key
			const apiKey = req.headers.get('x-api-key');
			if (!apiKey) {
				return new Response(JSON.stringify({ error: 'API key required' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			try {
				const protectApi = new ProtectApiService(env);
				if (!protectApi.validateApiKey(apiKey)) {
					return new Response(JSON.stringify({ error: 'Invalid API key' }), {
						status: 401,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				const cameraId = url.pathname.split('/')[3];
				const streams = await protectApi.getCameraStreams(cameraId);
				return json({ streams });
			} catch (error) {
				return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch camera streams' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		}

		if (url.pathname.startsWith('/protect/cameras/') && url.pathname.endsWith('/snapshot') && req.method === 'GET') {
			// Validate API key
			const apiKey = req.headers.get('x-api-key');
			if (!apiKey) {
				return new Response(JSON.stringify({ error: 'API key required' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			try {
				const protectApi = new ProtectApiService(env);
				if (!protectApi.validateApiKey(apiKey)) {
					return new Response(JSON.stringify({ error: 'Invalid API key' }), {
						status: 401,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				const cameraId = url.pathname.split('/')[3];
				const snapshot = await protectApi.getCameraSnapshot(cameraId);
				return new Response(snapshot, {
					headers: {
						'Content-Type': 'image/jpeg',
						'Cache-Control': 'no-cache',
					},
				});
			} catch (error) {
				return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch camera snapshot' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		}

		if (url.pathname.startsWith('/protect/cameras/') && url.pathname.endsWith('/feed') && req.method === 'GET') {
			// Camera feed endpoint - serves snapshots with auto-refresh capability
			const apiKey = req.headers.get('x-api-key');
			if (!apiKey) {
				return new Response(JSON.stringify({ error: 'API key required' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			try {
				const protectApi = new ProtectApiService(env);
				if (!protectApi.validateApiKey(apiKey)) {
					return new Response(JSON.stringify({ error: 'Invalid API key' }), {
						status: 401,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				const cameraId = url.pathname.split('/')[3];
				const snapshot = await protectApi.getCameraSnapshot(cameraId);

				// Check if client wants auto-refresh (for MJPEG stream simulation)
				const refresh = url.searchParams.get('refresh');
				if (refresh === 'true') {
					// Return MJPEG stream
					const boundary = '--frame';
					const mjpegStream = new ReadableStream({
						start(controller) {
							const sendFrame = async () => {
								try {
									const frameSnapshot = await protectApi.getCameraSnapshot(cameraId);
									const frame = `\r\n${boundary}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frameSnapshot.byteLength}\r\n\r\n`;
									controller.enqueue(new TextEncoder().encode(frame));
									controller.enqueue(new Uint8Array(frameSnapshot));

									// Schedule next frame (roughly 1 FPS)
									setTimeout(sendFrame, 1000);
								} catch (error) {
									console.error('Error in MJPEG stream:', error);
									controller.close();
								}
							};
							sendFrame();
						},
					});

					return new Response(mjpegStream, {
						headers: {
							'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
							'Cache-Control': 'no-cache',
							Connection: 'close',
						},
					});
				} else {
					// Return single snapshot
					return new Response(snapshot, {
						headers: {
							'Content-Type': 'image/jpeg',
							'Cache-Control': 'no-cache',
						},
					});
				}
			} catch (error) {
				return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch camera feed' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		}

		if (
			url.pathname.startsWith('/protect/cameras/') &&
			!url.pathname.endsWith('/streams') &&
			!url.pathname.endsWith('/snapshot') &&
			req.method === 'GET'
		) {
			// Validate API key
			const apiKey = req.headers.get('x-api-key');
			if (!apiKey) {
				return new Response(JSON.stringify({ error: 'API key required' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' },
				});
			}

			try {
				const protectApi = new ProtectApiService(env);
				if (!protectApi.validateApiKey(apiKey)) {
					return new Response(JSON.stringify({ error: 'Invalid API key' }), {
						status: 401,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				const cameraId = url.pathname.split('/')[3];
				const camera = await protectApi.getCamera(cameraId);

				if (!camera) {
					return new Response(JSON.stringify({ error: `Camera with ID ${cameraId} not found` }), {
						status: 404,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				return json(camera);
			} catch (error) {
				return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch camera' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		}

		// Log endpoints for FastAPI integration
		if (url.pathname === '/logs' && req.method === 'POST') {
			const requestId = crypto.randomUUID();
			const startTime = Date.now();

			try {
				console.log(`[${requestId}] Log entry POST received`, {
					timestamp: new Date().toISOString(),
					userAgent: req.headers.get('user-agent'),
					contentType: req.headers.get('content-type'),
					contentLength: req.headers.get('content-length'),
					sourceIp: req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown',
				});

				// No authentication required for writing logs - FastAPI can send logs freely

				// Parse request body
				const contentType = req.headers.get('content-type') || '';
				let logRequest: LogEntryRequest | LogEntryRequest[];

				if (contentType.includes('application/json')) {
					const body = (await req.json()) as LogEntryRequest | LogEntryRequest[];
					logRequest = body;
				} else {
					return new Response(JSON.stringify({ error: 'Content-Type must be application/json' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				const logService = new LogService(env);
				const sourceIp = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || undefined;
				const userAgent = req.headers.get('user-agent') || undefined;

				let result;
				if (Array.isArray(logRequest)) {
					// Batch log entries
					result = await logService.storeLogEntries(logRequest, sourceIp, userAgent);
				} else {
					// Single log entry
					result = await logService.storeLogEntry(logRequest, sourceIp, userAgent);
				}

				const responseTime = Date.now() - startTime;
				console.log(`[${requestId}] Log entry processed`, {
					success: result.success,
					responseTimeMs: responseTime,
					logId: result.logId,
					count: result.count,
				});

				return json(result, result.success ? 200 : 500);
			} catch (error) {
				const responseTime = Date.now() - startTime;
				console.error(`[${requestId}] Log entry processing error`, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					responseTimeMs: responseTime,
				});

				return new Response(
					JSON.stringify({
						success: false,
						message: 'Failed to process log entry',
						error: error instanceof Error ? error.message : 'Unknown error',
					}),
					{ status: 500, headers: { 'Content-Type': 'application/json' } },
				);
			}
		}

		if (url.pathname === '/logs' && req.method === 'GET') {
			const requestId = crypto.randomUUID();
			const startTime = Date.now();

			try {
				// Validate API key
				const apiKey = req.headers.get('x-api-key');
				if (!apiKey) {
					return new Response(JSON.stringify({ error: 'API key required' }), {
						status: 401,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				const protectApi = new ProtectApiService(env);
				if (!protectApi.validateApiKey(apiKey)) {
					return new Response(JSON.stringify({ error: 'Invalid API key' }), {
						status: 401,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				const logService = new LogService(env);

				// Parse query parameters
				const limit = parseInt(url.searchParams.get('limit') || '100');
				const offset = parseInt(url.searchParams.get('offset') || '0');
				const level = url.searchParams.get('level') || undefined;
				const loggerName = url.searchParams.get('logger_name') || undefined;
				const startDate = url.searchParams.get('start_date') || undefined;
				const endDate = url.searchParams.get('end_date') || undefined;
				const requestId = url.searchParams.get('request_id') || undefined;
				const correlationId = url.searchParams.get('correlation_id') || undefined;

				const result = await logService.getLogEntries(limit, offset, level, loggerName, startDate, endDate, requestId, correlationId);

				const responseTime = Date.now() - startTime;
				console.log(`[${requestId}] Log entries retrieved`, {
					success: result.success,
					responseTimeMs: responseTime,
					count: result.count,
				});

				return json(result);
			} catch (error) {
				const responseTime = Date.now() - startTime;
				console.error(`[${requestId}] Log entries retrieval error`, {
					error: error instanceof Error ? error.message : String(error),
					responseTimeMs: responseTime,
				});

				return new Response(
					JSON.stringify({
						success: false,
						message: 'Failed to retrieve log entries',
						error: error instanceof Error ? error.message : 'Unknown error',
					}),
					{ status: 500, headers: { 'Content-Type': 'application/json' } },
				);
			}
		}

		if (url.pathname === '/logs/stats' && req.method === 'GET') {
			const requestId = crypto.randomUUID();
			const startTime = Date.now();

			try {
				// Validate API key
				const apiKey = req.headers.get('x-api-key');
				if (!apiKey) {
					return new Response(JSON.stringify({ error: 'API key required' }), {
						status: 401,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				const protectApi = new ProtectApiService(env);
				if (!protectApi.validateApiKey(apiKey)) {
					return new Response(JSON.stringify({ error: 'Invalid API key' }), {
						status: 401,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				const logService = new LogService(env);
				const stats = await logService.getLogStatistics();

				const responseTime = Date.now() - startTime;
				console.log(`[${requestId}] Log statistics retrieved`, {
					responseTimeMs: responseTime,
					totalEntries: stats.totalEntries,
				});

				return json({
					success: true,
					message: 'Log statistics retrieved successfully',
					statistics: stats,
				});
			} catch (error) {
				const responseTime = Date.now() - startTime;
				console.error(`[${requestId}] Log statistics retrieval error`, {
					error: error instanceof Error ? error.message : String(error),
					responseTimeMs: responseTime,
				});

				return new Response(
					JSON.stringify({
						success: false,
						message: 'Failed to retrieve log statistics',
						error: error instanceof Error ? error.message : 'Unknown error',
					}),
					{ status: 500, headers: { 'Content-Type': 'application/json' } },
				);
			}
		}

		if (url.pathname === '/logs/cleanup' && req.method === 'POST') {
			const requestId = crypto.randomUUID();
			const startTime = Date.now();

			try {
				// Validate API key
				const apiKey = req.headers.get('x-api-key');
				if (!apiKey) {
					return new Response(JSON.stringify({ error: 'API key required' }), {
						status: 401,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				const protectApi = new ProtectApiService(env);
				if (!protectApi.validateApiKey(apiKey)) {
					return new Response(JSON.stringify({ error: 'Invalid API key' }), {
						status: 401,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				const logService = new LogService(env);
				const result = await logService.cleanupExpiredLogs();

				const responseTime = Date.now() - startTime;
				console.log(`[${requestId}] Log cleanup completed`, {
					success: result.success,
					responseTimeMs: responseTime,
					deletedCount: result.count,
				});

				return json(result);
			} catch (error) {
				const responseTime = Date.now() - startTime;
				console.error(`[${requestId}] Log cleanup error`, {
					error: error instanceof Error ? error.message : String(error),
					responseTimeMs: responseTime,
				});

				return new Response(
					JSON.stringify({
						success: false,
						message: 'Failed to cleanup expired logs',
						error: error instanceof Error ? error.message : 'Unknown error',
					}),
					{ status: 500, headers: { 'Content-Type': 'application/json' } },
				);
			}
		}

		// Webhook endpoints
		if (url.pathname === '/webhook' && req.method === 'POST') {
			const requestId = crypto.randomUUID();
			const startTime = Date.now();

			try {
				console.log(`[${requestId}] Webhook POST received`, {
					timestamp: new Date().toISOString(),
					userAgent: req.headers.get('user-agent'),
					contentType: req.headers.get('content-type'),
					contentLength: req.headers.get('content-length'),
					origin: req.headers.get('origin'),
					referer: req.headers.get('referer'),
				});

				const webhookHandler = new WebhookHandlerService(env);

				// Handle both JSON and plain text content types
				const contentType = req.headers.get('content-type') || '';
				let body: any;
				let originalJsonPayload: string | undefined;

				if (contentType.includes('application/json')) {
					const jsonText = await req.text();
					originalJsonPayload = jsonText;
					body = JSON.parse(jsonText);
				} else {
					// For plain text, try to parse as JSON first, fallback to text
					const textBody = await req.text();
					originalJsonPayload = textBody;

					console.log(`[${requestId}] Raw webhook text body`, {
						contentType,
						bodyLength: textBody.length,
						bodyPreview: textBody.substring(0, 200),
						bodyFull: textBody,
					});

					try {
						body = JSON.parse(textBody);
						console.log(`[${requestId}] Successfully parsed as JSON`, { body });
					} catch (jsonError) {
						console.log(`[${requestId}] JSON parse failed, treating as plain text`, {
							jsonError: jsonError instanceof Error ? jsonError.message : String(jsonError),
							textBody: textBody,
						});

						// If not JSON, create a structured payload from plain text
						body = {
							eventId: crypto.randomUUID(),
							cameraId: 'unknown',
							eventType: 'motion',
							timestamp: new Date().toISOString(),
							rawPayload: { text: textBody },
							type: 'plain_text',
						};
					}
				}

				console.log(`[${requestId}] Webhook payload parsed`, {
					contentType,
					eventId: body.eventId || 'generated',
					cameraId: body.cameraId || body.camera_id || 'unknown',
					eventType: body.eventType || body.event_type || 'motion',
					hasThumbnail: !!body.thumbnail,
					payloadSize: JSON.stringify(body).length,
					rawPayload: body,
				});

				// Parse webhook event
				const webhookEvent: WebhookEvent = {
					eventId: body.eventId || crypto.randomUUID(),
					cameraId: body.cameraId || body.camera_id || 'unknown',
					eventType: body.eventType || body.event_type || 'motion',
					timestamp: body.timestamp || new Date().toISOString(),
					thumbnail: body.thumbnail,
					rawPayload: body,
					type: body.type || body.eventType || body.event_type || 'motion',
				};

				console.log(`[${requestId}] Webhook event structured`, {
					eventId: webhookEvent.eventId,
					cameraId: webhookEvent.cameraId,
					eventType: webhookEvent.eventType,
					timestamp: webhookEvent.timestamp,
					hasThumbnail: !!webhookEvent.thumbnail,
					thumbnailSize: webhookEvent.thumbnail ? webhookEvent.thumbnail.length : 0,
				});

				// Process webhook asynchronously
				ctx.waitUntil(
					webhookHandler
						.processWebhookEvent(webhookEvent, originalJsonPayload, contentType)
						.then(() => {
							const processingTime = Date.now() - startTime;
							console.log(`[${requestId}] Webhook processing completed successfully`, {
								processingTimeMs: processingTime,
								eventId: webhookEvent.eventId,
								cameraId: webhookEvent.cameraId,
								eventType: webhookEvent.eventType,
							});
						})
						.catch((error) => {
							const processingTime = Date.now() - startTime;
							console.error(`[${requestId}] Webhook processing failed`, {
								error: error.message,
								stack: error.stack,
								processingTimeMs: processingTime,
								eventId: webhookEvent.eventId,
								cameraId: webhookEvent.cameraId,
								eventType: webhookEvent.eventType,
							});
						}),
				);

				const responseTime = Date.now() - startTime;
				console.log(`[${requestId}] Webhook response sent`, {
					status: 200,
					responseTimeMs: responseTime,
					eventId: webhookEvent.eventId,
				});

				return json({
					success: true,
					message: 'Webhook received and queued for processing',
					requestId,
					eventId: webhookEvent.eventId,
				});
			} catch (error) {
				const responseTime = Date.now() - startTime;
				console.error(`[${requestId}] Webhook processing error`, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					responseTimeMs: responseTime,
					userAgent: req.headers.get('user-agent'),
					contentType: req.headers.get('content-type'),
				});

				return new Response(
					JSON.stringify({
						error: 'Failed to process webhook',
						requestId,
						message: error instanceof Error ? error.message : 'Unknown error',
					}),
					{ status: 500, headers: { 'Content-Type': 'application/json' } },
				);
			}
		}

		if (url.pathname.startsWith('/fetch/') && req.method === 'GET') {
			try {
				// Extract the R2 key from the path
				const r2Key = url.pathname.replace('/fetch/', '');

				// Get object from R2
				const object = await env.BUCKET.get(r2Key);

				if (!object) {
					return new Response('Not found', { status: 404 });
				}

				// Return the object with appropriate headers
				return new Response(object.body, {
					headers: {
						'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
						'Cache-Control': 'public, max-age=3600',
					},
				});
			} catch (error) {
				console.error('R2 fetch error:', error);
				return new Response('Internal server error', { status: 500 });
			}
		}

		// Webhook events endpoint
		if (url.pathname === '/webhook/events' && req.method === 'GET') {
			const requestId = crypto.randomUUID();
			const startTime = Date.now();

			try {
				console.log(`[${requestId}] Webhook events GET request received`, {
					timestamp: new Date().toISOString(),
					userAgent: req.headers.get('user-agent'),
					origin: req.headers.get('origin'),
					referer: req.headers.get('referer'),
				});

				// Validate API key
				const apiKey = req.headers.get('x-api-key');
				if (!apiKey || apiKey !== env.WORKER_API_KEY) {
					console.log(`[${requestId}] Unauthorized webhook events request`, {
						hasApiKey: !!apiKey,
						apiKeyPrefix: apiKey ? apiKey.substring(0, 4) + '...' : 'none',
					});
					return new Response('Unauthorized', { status: 401 });
				}

				console.log(`[${requestId}] Fetching webhook events from D1`, {
					apiKeyPrefix: apiKey.substring(0, 4) + '...',
				});

				// Get webhook events from D1, ordered by timestamp, limit 20
				const stmt = env.DB.prepare(`
          SELECT * FROM webhook_events
          ORDER BY timestamp DESC
          LIMIT 20
        `);

				const result = await stmt.all();
				const fetchTime = Date.now() - startTime;

				console.log(`[${requestId}] Webhook events fetched successfully`, {
					eventCount: result.results?.length || 0,
					fetchTimeMs: fetchTime,
					dbMeta: result.meta,
				});

				return json({
					success: true,
					events: result.results || [],
					count: result.results?.length || 0,
					requestId,
				});
			} catch (error) {
				const fetchTime = Date.now() - startTime;
				console.error(`[${requestId}] Webhook events fetch error`, {
					error: error instanceof Error ? error.message : String(error),
					stack: error instanceof Error ? error.stack : undefined,
					fetchTimeMs: fetchTime,
				});
				return new Response('Internal server error', { status: 500 });
			}
		}

		// Unit Test Management endpoints
		if (url.pathname === '/unit-tests/sessions' && req.method === 'POST') {
			try {
				const unitTestService = new UnitTestService(env);
				const body = (await req.json()) as { session_id: string; total_tests?: number };

				if (!body.session_id) {
					return new Response(JSON.stringify({ error: 'session_id is required' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				const session = await unitTestService.createSession(body);
				return json({
					success: true,
					session_id: session.session_id,
					message: 'Unit test session created successfully',
				});
			} catch (error) {
				console.error('Error creating unit test session:', error);
				return new Response(JSON.stringify({ error: 'Failed to create unit test session' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		}

		if (url.pathname === '/unit-tests/sessions' && req.method === 'GET') {
			try {
				const unitTestService = new UnitTestService(env);
				const limit = parseInt(url.searchParams.get('limit') || '50');
				const offset = parseInt(url.searchParams.get('offset') || '0');

				const sessions = await unitTestService.listSessions(limit, offset);
				return json({
					success: true,
					sessions,
					pagination: { limit, offset },
				});
			} catch (error) {
				console.error('Error listing unit test sessions:', error);
				return new Response(JSON.stringify({ error: 'Failed to list unit test sessions' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		}

		if (url.pathname.startsWith('/unit-tests/sessions/') && url.pathname.endsWith('/tests') && req.method === 'POST') {
			try {
				const sessionId = url.pathname.split('/')[3];
				const unitTestService = new UnitTestService(env);
				const body = (await req.json()) as { test_name: string; test_category?: string };

				if (!body.test_name) {
					return new Response(JSON.stringify({ error: 'test_name is required' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				const test = await unitTestService.createTest({
					session_id: sessionId,
					test_name: body.test_name,
					test_category: body.test_category,
				});

				return json({
					success: true,
					test_name: test.test_name,
					message: 'Test record created successfully',
				});
			} catch (error) {
				console.error('Error creating test record:', error);
				return new Response(JSON.stringify({ error: 'Failed to create test record' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		}

		if (url.pathname.startsWith('/unit-tests/sessions/') && url.pathname.endsWith('/tests') && req.method === 'GET') {
			try {
				const sessionId = url.pathname.split('/')[3];
				const unitTestService = new UnitTestService(env);

				const tests = await unitTestService.getTestResults(sessionId);
				const stats = await unitTestService.getSessionStats(sessionId);

				return json({
					success: true,
					session_id: sessionId,
					tests,
					stats,
				});
			} catch (error) {
				console.error('Error getting test results:', error);
				return new Response(JSON.stringify({ error: 'Failed to get test results' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		}

		if (url.pathname.startsWith('/unit-tests/sessions/') && url.pathname.endsWith('/update-test') && req.method === 'POST') {
			try {
				const sessionId = url.pathname.split('/')[3];
				const unitTestService = new UnitTestService(env);
				const body = (await req.json()) as {
					test_name: string;
					status: 'running' | 'passed' | 'failed' | 'skipped' | 'error';
					test_results?: any;
					error_message?: string;
					duration_ms?: number;
				};

				if (!body.test_name || !body.status) {
					return new Response(JSON.stringify({ error: 'test_name and status are required' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				const test = await unitTestService.updateTestResult({
					session_id: sessionId,
					test_name: body.test_name,
					status: body.status,
					test_results: body.test_results,
					error_message: body.error_message,
					duration_ms: body.duration_ms,
				});

				return json({
					success: true,
					test_name: test?.test_name,
					status: test?.status,
					message: 'Test result updated successfully',
				});
			} catch (error) {
				console.error('Error updating test result:', error);
				return new Response(JSON.stringify({ error: 'Failed to update test result' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		}

		if (url.pathname.startsWith('/unit-tests/sessions/') && url.pathname.endsWith('/complete') && req.method === 'POST') {
			try {
				const sessionId = url.pathname.split('/')[3];
				const unitTestService = new UnitTestService(env);
				const body = (await req.json()) as {
					status: 'completed' | 'failed' | 'cancelled';
					completed_tests?: number;
					failed_tests?: number;
				};

				if (!body.status) {
					return new Response(JSON.stringify({ error: 'status is required' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				const session = await unitTestService.updateSession({
					session_id: sessionId,
					status: body.status,
					completed_tests: body.completed_tests,
					failed_tests: body.failed_tests,
				});

				return json({
					success: true,
					session_id: session?.session_id,
					status: session?.status,
					message: 'Session updated successfully',
				});
			} catch (error) {
				console.error('Error updating session:', error);
				return new Response(JSON.stringify({ error: 'Failed to update session' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		}

		if (url.pathname.startsWith('/unit-tests/sessions/') && req.method === 'GET') {
			try {
				const sessionId = url.pathname.split('/')[3];
				const unitTestService = new UnitTestService(env);

				const session = await unitTestService.getSession(sessionId);
				if (!session) {
					return new Response(JSON.stringify({ error: 'Session not found' }), {
						status: 404,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				const tests = await unitTestService.getTestResults(sessionId);
				const stats = await unitTestService.getSessionStats(sessionId);

				return json({
					success: true,
					session,
					tests,
					stats,
				});
			} catch (error) {
				console.error('Error getting session details:', error);
				return new Response(JSON.stringify({ error: 'Failed to get session details' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		}

		// Worker Self-Test endpoint
		if (url.pathname === '/worker/self-test' && req.method === 'POST') {
			try {
				const body = (await req.json()) as {
					base_url?: string;
					api_key?: string;
					timeout_ms?: number;
				};

				const selfTestService = new WorkerSelfTestService(env, {
					base_url: body.base_url || `https://${url.hostname}`,
					api_key: body.api_key || env.WORKER_API_KEY,
					timeout_ms: body.timeout_ms,
				});

				const result = await selfTestService.runSelfTests();

				return json({
					success: true,
					session_id: result.session_id,
					message: 'Worker self-tests completed',
					summary: {
						total_tests: result.results.length,
						passed: result.results.filter((r) => r.status === 'passed').length,
						failed: result.results.filter((r) => r.status === 'failed').length,
						errors: result.results.filter((r) => r.status === 'error').length,
					},
					results: result.results,
				});
			} catch (error) {
				console.error('Error running worker self-tests:', error);
				return new Response(
					JSON.stringify({
						error: 'Failed to run worker self-tests',
						details: error instanceof Error ? error.message : String(error),
					}),
					{ status: 500, headers: { 'Content-Type': 'application/json' } },
				);
			}
		}

		// Worker Self-Test Status endpoint
		if (url.pathname === '/worker/self-test/status' && req.method === 'GET') {
			try {
				const sessionId = url.searchParams.get('session_id');
				if (!sessionId) {
					return new Response(JSON.stringify({ error: 'session_id parameter is required' }), {
						status: 400,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				const selfTestService = new WorkerSelfTestService(env, {
					base_url: `https://${url.hostname}`,
					api_key: env.WORKER_API_KEY,
				});

				const [session, tests, stats] = await Promise.all([
					selfTestService.unitTestService.getSession(sessionId),
					selfTestService.getTestResults(sessionId),
					selfTestService.getTestSessionStats(sessionId),
				]);

				if (!session) {
					return new Response(JSON.stringify({ error: 'Session not found' }), {
						status: 404,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				return json({
					success: true,
					session,
					tests,
					stats,
				});
			} catch (error) {
				console.error('Error getting self-test status:', error);
				return new Response(
					JSON.stringify({
						error: 'Failed to get self-test status',
						details: error instanceof Error ? error.message : String(error),
					}),
					{ status: 500, headers: { 'Content-Type': 'application/json' } },
				);
			}
		}

		// Unit Test Agent Prompt endpoint
		if (url.pathname === '/unit-test-agent-prompt' && req.method === 'GET') {
			try {
				const promptFile = await env.ASSETS.fetch(new Request(new URL('/UNIT_TEST_AGENT_PROMPT.md', req.url)));

				if (!promptFile.ok) {
					return new Response(JSON.stringify({ error: 'Unit test agent prompt file not found' }), {
						status: 404,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				const content = await promptFile.text();

				return new Response(content, {
					headers: {
						'Content-Type': 'text/markdown; charset=utf-8',
						'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
						'Access-Control-Allow-Origin': '*',
					},
				});
			} catch (error) {
				console.error('Error serving unit test agent prompt:', error);
				return new Response(
					JSON.stringify({
						error: 'Failed to serve unit test agent prompt',
						details: error instanceof Error ? error.message : String(error),
					}),
					{ status: 500, headers: { 'Content-Type': 'application/json' } },
				);
			}
		}

		return new Response('not found', { status: 404 });
	},

	// Cron trigger
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		const securitySweep = new SecuritySweepService(env);
		const logService = new LogService(env);

		// Run security sweep
		ctx.waitUntil(securitySweep.runSecuritySweep({ trigger: 'cron' }));

		// Clean up expired log entries (runs daily)
		ctx.waitUntil(
			logService
				.cleanupExpiredLogs()
				.then((result) => {
					console.log('Scheduled log cleanup completed:', result);
				})
				.catch((error) => {
					console.error('Scheduled log cleanup failed:', error);
				}),
		);
	},

	// Queue consumer
	async queue(batch: MessageBatch<any>, env: Env, ctx: ExecutionContext) {
		console.log(`Processing ${batch.messages.length} messages from queue`);

		for (const message of batch.messages) {
			try {
				const event = message.body as WebhookEvent;
				console.log(`Processing event: ${event.type} for camera: ${event.cameraId}`);

				// Process the event (you can add specific logic here)
				// For now, just log it
				console.log('Event processed:', event);

				// Acknowledge the message
				message.ack();
			} catch (error) {
				console.error('Error processing message:', error);
				// Retry the message
				message.retry();
			}
		}
	},
};
