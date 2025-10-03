import type { Env, WebhookEvent } from './types.js';
import { SecuritySweepService } from './services/security-sweep.js';
import { ProtectApiService } from './services/protect-api.js';
import { WebhookHandlerService } from './services/webhook-handler.js';
import { json } from './utils/response.js';

export default {
  // HTTP endpoints
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(req.url);

    // Handle static assets first
    if (url.pathname.startsWith('/public/') || url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/openapi.json' || url.pathname === '/favicon.ico') {
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

    if (req.method === "POST" && url.pathname === "/webhook") {
      // Example: HA or Protect -> Worker
      // Expect JSON with {type, camera, event,...}
      const event = await req.json().catch(() => null) as WebhookEvent | null;
      if (!event) return new Response("bad json", { status: 400 });

      // reactively run a focused sweep
      const securitySweep = new SecuritySweepService(env);
      ctx.waitUntil(
        securitySweep.runSecuritySweep({
          trigger: `event:${event.type}`,
          focusCamera: event.cameraId || null
        })
      );
      return new Response("ok");
    }

    if (url.pathname === "/agent/security_sweep") {
      // API-triggered on-demand sweep (GET or POST)
      const focus = url.searchParams.get("camera");
      const securitySweep = new SecuritySweepService(env);
      const result = await securitySweep.runSecuritySweep({
        trigger: "api",
        focusCamera: focus
      });
      return json(result);
    }

    // UniFi Protect API endpoints
    if (url.pathname === "/protect/login" && req.method === "POST") {
      try {
        const protectApi = new ProtectApiService(env);
        const result = await protectApi.login();
        return json(result);
      } catch (error) {
        return new Response(
          JSON.stringify({ error: error instanceof Error ? error.message : 'Login failed' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    if (url.pathname === "/protect/cameras" && req.method === "GET") {
      // Validate API key
      const apiKey = req.headers.get('x-api-key');
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: 'API key required' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      try {
        const protectApi = new ProtectApiService(env);
        if (!protectApi.validateApiKey(apiKey)) {
          return new Response(
            JSON.stringify({ error: 'Invalid API key' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const cameras = await protectApi.getCameras();
        return json({ cameras });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch cameras' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    if (url.pathname.startsWith("/protect/cameras/") && url.pathname.endsWith("/streams") && req.method === "GET") {
      // Validate API key
      const apiKey = req.headers.get('x-api-key');
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: 'API key required' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      try {
        const protectApi = new ProtectApiService(env);
        if (!protectApi.validateApiKey(apiKey)) {
          return new Response(
            JSON.stringify({ error: 'Invalid API key' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const cameraId = url.pathname.split('/')[3];
        const streams = await protectApi.getCameraStreams(cameraId);
        return json({ streams });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch camera streams' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    if (url.pathname.startsWith("/protect/cameras/") && url.pathname.endsWith("/snapshot") && req.method === "GET") {
      // Validate API key
      const apiKey = req.headers.get('x-api-key');
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: 'API key required' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      try {
        const protectApi = new ProtectApiService(env);
        if (!protectApi.validateApiKey(apiKey)) {
          return new Response(
            JSON.stringify({ error: 'Invalid API key' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const cameraId = url.pathname.split('/')[3];
        const snapshot = await protectApi.getCameraSnapshot(cameraId);
        return new Response(snapshot, {
          headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'no-cache'
          }
        });
      } catch (error) {
        return new Response(
          JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch camera snapshot' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    if (url.pathname.startsWith("/protect/cameras/") && !url.pathname.endsWith("/streams") && !url.pathname.endsWith("/snapshot") && req.method === "GET") {
      // Validate API key
      const apiKey = req.headers.get('x-api-key');
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: 'API key required' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      try {
        const protectApi = new ProtectApiService(env);
        if (!protectApi.validateApiKey(apiKey)) {
          return new Response(
            JSON.stringify({ error: 'Invalid API key' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const cameraId = url.pathname.split('/')[3];
        const camera = await protectApi.getCamera(cameraId);

        if (!camera) {
          return new Response(
            JSON.stringify({ error: `Camera with ID ${cameraId} not found` }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return json(camera);
      } catch (error) {
        return new Response(
          JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to fetch camera' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Webhook endpoints
    if (url.pathname === '/webhook' && req.method === 'POST') {
      try {
        const webhookHandler = new WebhookHandlerService(env);
        const body = await req.json() as any;

        // Parse webhook event
        const webhookEvent: WebhookEvent = {
          eventId: body.eventId || crypto.randomUUID(),
          cameraId: body.cameraId || body.camera_id,
          eventType: body.eventType || body.event_type || 'motion',
          timestamp: body.timestamp || new Date().toISOString(),
          thumbnail: body.thumbnail,
          rawPayload: body,
          type: body.type || body.eventType || body.event_type || 'motion'
        };

        // Process webhook asynchronously
        ctx.waitUntil(webhookHandler.processWebhookEvent(webhookEvent));

        return json({ success: true, message: 'Webhook received and queued for processing' });
      } catch (error) {
        console.error('Webhook processing error:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to process webhook' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
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

    return new Response("not found", { status: 404 });
  },

  // Cron trigger
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const securitySweep = new SecuritySweepService(env);
    ctx.waitUntil(securitySweep.runSecuritySweep({ trigger: "cron" }));
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
