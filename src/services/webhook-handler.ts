import { Env } from '../types';

export interface WebhookEvent {
  eventId: string;
  cameraId: string;
  eventType: string;
  timestamp: string;
  thumbnail?: string; // base64 encoded
  rawPayload: any;
}

export interface FaceRecognitionResult {
  faceUuid: string;
  embeddings: number[];
  tags: Record<string, any>;
  confidence: number;
}

export interface TeslaPatrolResult {
  teslaDetected: boolean;
  garageDoorStatus: 'open' | 'closed' | 'closing' | 'opening';
  teslaLocation?: {
    latitude: number;
    longitude: number;
  };
}

export class WebhookHandlerService {
  constructor(private env: Env) {}

  /**
   * Process incoming webhook event
   */
  async processWebhookEvent(event: WebhookEvent): Promise<void> {
    const processingId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      console.log(`[${processingId}] Starting webhook event processing`, {
        eventId: event.eventId,
        cameraId: event.cameraId,
        eventType: event.eventType,
        timestamp: event.timestamp,
        hasThumbnail: !!event.thumbnail,
        processingStartTime: new Date().toISOString()
      });

      // For now, use the cameraId directly as the camera_enum_id
      // In the future, we could populate a cameras table or validate against Protect API
      const cameraEnumId = event.cameraId;

      // Save webhook event to D1
      console.log(`[${processingId}] Saving webhook event to D1 database`, {
        eventId: event.eventId,
        cameraEnumId,
        eventType: event.eventType
      });

      await this.saveWebhookEvent(event, cameraEnumId);

      const dbSaveTime = Date.now() - startTime;
      console.log(`[${processingId}] Webhook event saved to D1 successfully`, {
        eventId: event.eventId,
        dbSaveTimeMs: dbSaveTime
      });

      // Process thumbnail if present
      let thumbnailR2Key: string | null = null;
      if (event.thumbnail) {
        console.log(`[${processingId}] Processing thumbnail for webhook event`, {
          eventId: event.eventId,
          thumbnailSize: event.thumbnail.length,
          cameraEnumId
        });

        const thumbnailStartTime = Date.now();
        thumbnailR2Key = await this.saveThumbnail(cameraEnumId, event.eventId, event.thumbnail);
        const thumbnailTime = Date.now() - thumbnailStartTime;

        console.log(`[${processingId}] Thumbnail saved to R2 successfully`, {
          eventId: event.eventId,
          thumbnailR2Key,
          thumbnailProcessingTimeMs: thumbnailTime
        });
      } else {
        console.log(`[${processingId}] No thumbnail to process`, {
          eventId: event.eventId
        });
      }

      // Update webhook event with thumbnail R2 key
      if (thumbnailR2Key) {
        console.log(`[${processingId}] Updating webhook event with thumbnail R2 key`, {
          eventId: event.eventId,
          thumbnailR2Key
        });
        await this.updateWebhookEventThumbnail(event.eventId, thumbnailR2Key);
      }

      // Get security patrol configurations for this camera
      console.log(`[${processingId}] Checking security patrol configurations`, {
        eventId: event.eventId,
        cameraEnumId,
        eventType: event.eventType
      });

      const patrolConfigs = await this.getSecurityPatrolConfigs(cameraEnumId, event.eventType);

      console.log(`[${processingId}] Found security patrol configurations`, {
        eventId: event.eventId,
        configCount: patrolConfigs.length,
        configs: patrolConfigs.map(c => ({ id: c.id, name: c.job_name, type: c.ai_analysis_type }))
      });

      // Process each configuration
      for (const config of patrolConfigs) {
        console.log(`[${processingId}] Processing security patrol configuration`, {
          eventId: event.eventId,
          configId: config.id,
          configName: config.job_name,
          aiAnalysisType: config.ai_analysis_type
        });

        await this.processSecurityPatrol(config, event, thumbnailR2Key);
      }

      // Mark webhook as processed
      console.log(`[${processingId}] Marking webhook as processed`, {
        eventId: event.eventId
      });
      await this.markWebhookProcessed(event.eventId);

      const totalProcessingTime = Date.now() - startTime;
      console.log(`[${processingId}] Webhook event processing completed successfully`, {
        eventId: event.eventId,
        cameraId: event.cameraId,
        eventType: event.eventType,
        totalProcessingTimeMs: totalProcessingTime,
        hasThumbnail: !!thumbnailR2Key,
        thumbnailR2Key,
        patrolConfigsProcessed: patrolConfigs.length,
        processingEndTime: new Date().toISOString()
      });

    } catch (error) {
      const totalProcessingTime = Date.now() - startTime;
      console.error(`[${processingId}] Error processing webhook event`, {
        eventId: event.eventId,
        cameraId: event.cameraId,
        eventType: event.eventType,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        totalProcessingTimeMs: totalProcessingTime,
        processingEndTime: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Get camera by enum_id
   */
  private async getCameraByEnumId(cameraId: string): Promise<any | null> {
    const stmt = this.env.DB.prepare(`
      SELECT * FROM cameras WHERE enum_id = ? AND is_active = 1
    `);
    return await stmt.bind(cameraId).first();
  }

  /**
   * Save webhook event to D1
   */
  private async saveWebhookEvent(event: WebhookEvent, cameraEnumId: string): Promise<void> {
    const saveId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      // Validate required fields
      const eventId = event.eventId || crypto.randomUUID();
      const cameraId = cameraEnumId || 'unknown';
      const eventType = event.eventType || 'motion';
      const timestamp = event.timestamp || new Date().toISOString();
      const rawPayload = event.rawPayload || {};

      console.log(`[${saveId}] Preparing to save webhook event to D1`, {
        eventId,
        cameraId,
        eventType,
        timestamp,
        rawPayloadSize: JSON.stringify(rawPayload).length
      });

      const stmt = this.env.DB.prepare(`
        INSERT INTO webhook_events (event_id, camera_enum_id, event_type, timestamp, raw_payload, thumbnail_r2_key)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = await stmt.bind(
        eventId,
        cameraId,
        eventType,
        timestamp,
        JSON.stringify(rawPayload),
        null // Will be updated if thumbnail is saved
      ).run();

      const saveTime = Date.now() - startTime;
      console.log(`[${saveId}] Webhook event saved to D1 successfully`, {
        eventId,
        cameraId,
        eventType,
        dbResult: {
          meta: result.meta
        },
        saveTimeMs: saveTime
      });
    } catch (error) {
      const saveTime = Date.now() - startTime;
      console.error(`[${saveId}] Error saving webhook event to D1`, {
        eventId: event.eventId || 'unknown',
        cameraEnumId: cameraEnumId || 'unknown',
        eventType: event.eventType || 'unknown',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        saveTimeMs: saveTime
      });
      throw error;
    }
  }

  /**
   * Save thumbnail to R2 and return the key
   */
  private async saveThumbnail(cameraId: string, eventId: string, base64Data: string): Promise<string> {
    try {
      // Remove data URL prefix if present
      const base64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      const imageBuffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

      const r2Key = `webhook/thumbnails/${cameraId}/${eventId}.jpg`;

      await this.env.BUCKET.put(r2Key, imageBuffer, {
        httpMetadata: {
          contentType: 'image/jpeg',
        },
      });

      return r2Key;
    } catch (error) {
      console.error('Error saving thumbnail:', error);
      throw error;
    }
  }

  /**
   * Update webhook event with thumbnail R2 key
   */
  private async updateWebhookEventThumbnail(eventId: string, thumbnailR2Key: string): Promise<void> {
    const stmt = this.env.DB.prepare(`
      UPDATE webhook_events
      SET thumbnail_r2_key = ?
      WHERE event_id = ?
    `);

    await stmt.bind(thumbnailR2Key, eventId).run();
  }

  /**
   * Get security patrol configurations for camera and event type
   */
  private async getSecurityPatrolConfigs(cameraId: string, eventType: string): Promise<any[]> {
    // First get the camera enum_id from the camera_id
    const cameraStmt = this.env.DB.prepare(`
      SELECT enum_id FROM cameras WHERE id = ?
    `);
    const camera = await cameraStmt.bind(cameraId).first();

    if (!camera) {
      return [];
    }

    // Get webhook patrol configs for this camera and event type
    const stmt = this.env.DB.prepare(`
      SELECT wpc.*, pjc.name as job_name, pjc.overall_prompt
      FROM webhook_patrol_configs wpc
      JOIN patrol_job_configs pjc ON wpc.patrol_job_config_id = pjc.id
      WHERE wpc.camera_enum_id = ? AND wpc.trigger_event = ? AND wpc.enabled = TRUE
    `);

    const result = await stmt.bind(camera.enum_id, eventType).all();
    return result.results || [];
  }

  /**
   * Process security patrol based on configuration
   */
  private async processSecurityPatrol(config: any, event: WebhookEvent, thumbnailR2Key: string | null): Promise<void> {
    const configData = JSON.parse(config.config_json);

    switch (config.ai_analysis_type) {
      case 'face_recognition':
        if (thumbnailR2Key) {
          await this.processFaceRecognition(configData, event, thumbnailR2Key);
        }
        break;

      case 'tesla_patrol':
        if (thumbnailR2Key) {
          await this.processTeslaPatrol(configData, event, thumbnailR2Key);
        }
        break;

      default:
        console.warn(`Unknown AI analysis type: ${config.ai_analysis_type}`);
    }
  }

  /**
   * Process face recognition analysis
   */
  private async processFaceRecognition(config: any, event: WebhookEvent, thumbnailR2Key: string): Promise<void> {
    try {
      // Get thumbnail from R2
      const thumbnailObject = await this.env.BUCKET.get(thumbnailR2Key);
      if (!thumbnailObject) {
        throw new Error('Thumbnail not found in R2');
      }

      // Analyze image with Workers AI
      const analysisResult = await this.analyzeImageForFaces(await thumbnailObject.arrayBuffer());

      if (analysisResult) {
        // Save face data
        await this.saveFaceData(analysisResult, thumbnailR2Key, event);

        // Send notification
        await this.sendNotification('face_detected', 'Face Detected',
          `Face detected at ${event.cameraId}`, {
            faceUuid: analysisResult.faceUuid,
            confidence: analysisResult.confidence,
            tags: analysisResult.tags,
            cameraId: event.cameraId
          });
      }
    } catch (error) {
      console.error('Error processing face recognition:', error);
    }
  }

  /**
   * Process Tesla patrol analysis
   */
  private async processTeslaPatrol(config: any, event: WebhookEvent, thumbnailR2Key: string): Promise<void> {
    try {
      // Check if there's already an active session for this camera
      const activeSession = await this.getActiveTeslaPatrolSession(event.cameraId);

      if (activeSession) {
        // Continue existing session
        await this.continueTeslaPatrolSession(activeSession, event, thumbnailR2Key);
      } else {
        // Start new session
        await this.startTeslaPatrolSession(config, event, thumbnailR2Key);
      }
    } catch (error) {
      console.error('Error processing Tesla patrol:', error);
    }
  }

  /**
   * Analyze image for faces using Workers AI
   */
  private async analyzeImageForFaces(imageBuffer: ArrayBuffer): Promise<FaceRecognitionResult | null> {
    try {
      // Convert to base64 for AI analysis
      const base64 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));

      const response = await this.env.AI.run('@cf/meta/llama-3.2-1b-instruct', {
        messages: [
          {
            role: 'user',
            content: `Analyze this image for faces. Return a JSON object with face detection results including embeddings, confidence, and tags like is_delivery_person, is_known_person, etc. Image: data:image/jpeg;base64,${base64}`
          }
        ]
      });

      // Parse AI response and extract face data
      // This is a simplified implementation - you'd need to implement proper face detection
      const faceUuid = crypto.randomUUID();
      const embeddings = new Array(128).fill(0).map(() => Math.random()); // Placeholder embeddings
      const tags = { is_delivery_person: false, is_known_person: false };
      const confidence = 0.8;

      return {
        faceUuid,
        embeddings,
        tags,
        confidence
      };
    } catch (error) {
      console.error('Error analyzing image for faces:', error);
      return null;
    }
  }

  /**
   * Save face data to D1 and R2
   */
  private async saveFaceData(faceResult: FaceRecognitionResult, thumbnailR2Key: string, event: WebhookEvent): Promise<void> {
    try {
      // Save face image to R2
      const faceR2Key = `faces/${faceResult.faceUuid}/image.jpg`;
      const thumbnailObject = await this.env.BUCKET.get(thumbnailR2Key);
      if (thumbnailObject) {
        await this.env.BUCKET.put(faceR2Key, await thumbnailObject.arrayBuffer());
      }

      // Save face data to D1
      const stmt = this.env.DB.prepare(`
        INSERT INTO faces (face_uuid, embeddings, r2_key, tags, confidence, last_seen)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(face_uuid) DO UPDATE SET
          last_seen = ?,
          confidence = MAX(confidence, ?),
          tags = json_patch(tags, ?)
      `);

      await stmt.bind(
        faceResult.faceUuid,
        JSON.stringify(faceResult.embeddings),
        faceR2Key,
        JSON.stringify(faceResult.tags),
        faceResult.confidence,
        new Date().toISOString(),
        new Date().toISOString(),
        faceResult.confidence,
        JSON.stringify(faceResult.tags)
      ).run();
    } catch (error) {
      console.error('Error saving face data:', error);
    }
  }

  /**
   * Start new Tesla patrol session
   */
  private async startTeslaPatrolSession(config: any, event: WebhookEvent, thumbnailR2Key: string): Promise<void> {
    const sessionUuid = crypto.randomUUID();

    // Create session record
    const stmt = this.env.DB.prepare(`
      INSERT INTO tesla_patrol_sessions (session_uuid, camera_id, max_snapshots)
      VALUES (?, ?, ?)
    `);

    await stmt.bind(sessionUuid, event.cameraId, 12).run();

    // Take first snapshot
    await this.takeTeslaPatrolSnapshot(sessionUuid, 1, thumbnailR2Key);

    // Start monitoring
    await this.monitorTeslaPatrol(sessionUuid, config);
  }

  /**
   * Continue existing Tesla patrol session
   */
  private async continueTeslaPatrolSession(session: any, event: WebhookEvent, thumbnailR2Key: string): Promise<void> {
    const snapshotNumber = session.snapshots_taken + 1;

    if (snapshotNumber <= session.max_snapshots) {
      await this.takeTeslaPatrolSnapshot(session.session_uuid, snapshotNumber, thumbnailR2Key);
    }
  }

  /**
   * Take Tesla patrol snapshot
   */
  private async takeTeslaPatrolSnapshot(sessionUuid: string, snapshotNumber: number, thumbnailR2Key: string): Promise<void> {
    try {
      // Copy thumbnail to Tesla patrol folder
      const teslaR2Key = `tesla_patrol/${sessionUuid}/snapshot_${snapshotNumber}.jpg`;
      const thumbnailObject = await this.env.BUCKET.get(thumbnailR2Key);

      if (thumbnailObject) {
        await this.env.BUCKET.put(teslaR2Key, await thumbnailObject.arrayBuffer());
      }

      // Analyze for Tesla and garage door
      const analysis = await this.analyzeTeslaPatrolImage(await thumbnailObject!.arrayBuffer());

      // Save snapshot record
      const stmt = this.env.DB.prepare(`
        INSERT INTO tesla_patrol_snapshots (session_id, snapshot_number, r2_key, tesla_visible, garage_door_visible, ai_analysis)
        SELECT ?, ?, ?, ?, ?, ?
        FROM tesla_patrol_sessions WHERE session_uuid = ?
      `);

      await stmt.bind(
        null, // Will be filled by subquery
        snapshotNumber,
        teslaR2Key,
        analysis.teslaDetected,
        analysis.garageDoorVisible,
        JSON.stringify(analysis),
        sessionUuid
      ).run();

      // Update session snapshot count
      await this.env.DB.prepare(`
        UPDATE tesla_patrol_sessions
        SET snapshots_taken = snapshots_taken + 1
        WHERE session_uuid = ?
      `).bind(sessionUuid).run();

    } catch (error) {
      console.error('Error taking Tesla patrol snapshot:', error);
    }
  }

  /**
   * Analyze image for Tesla and garage door
   */
  private async analyzeTeslaPatrolImage(imageBuffer: ArrayBuffer): Promise<any> {
    try {
      const base64 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));

      const response = await this.env.AI.run('@cf/meta/llama-3.2-1b-instruct', {
        messages: [
          {
            role: 'user',
            content: `Analyze this garage camera image. Look for:
            1. Tesla vehicle (any Tesla model)
            2. Garage door status (open, closed, opening, closing)
            3. Vehicle movement (backing out, pulling in, stationary)

            Return JSON: {"teslaDetected": boolean, "garageDoorStatus": "open|closed|opening|closing", "vehicleMovement": "backing_out|pulling_in|stationary|none"}

            Image: data:image/jpeg;base64,${base64}`
          }
        ]
      });

      // Parse AI response
      return {
        teslaDetected: true, // Placeholder
        garageDoorVisible: true,
        garageDoorStatus: 'open',
        vehicleMovement: 'backing_out'
      };
    } catch (error) {
      console.error('Error analyzing Tesla patrol image:', error);
      return {
        teslaDetected: false,
        garageDoorVisible: false,
        garageDoorStatus: 'unknown',
        vehicleMovement: 'none'
      };
    }
  }

  /**
   * Monitor Tesla patrol session
   */
  private async monitorTeslaPatrol(sessionUuid: string, config: any): Promise<void> {
    // This would be implemented as a background task
    // For now, we'll just set up the monitoring logic
    console.log(`Tesla patrol session ${sessionUuid} started`);
  }

  /**
   * Get active Tesla patrol session
   */
  private async getActiveTeslaPatrolSession(cameraId: string): Promise<any | null> {
    const stmt = this.env.DB.prepare(`
      SELECT * FROM tesla_patrol_sessions
      WHERE camera_id = ? AND status = 'active'
      ORDER BY start_time DESC LIMIT 1
    `);

    const result = await stmt.bind(cameraId).first();
    return result;
  }

  /**
   * Send notification
   */
  private async sendNotification(type: string, title: string, message: string, data?: any): Promise<void> {
    try {
      if (this.env.NTFY_TOPIC_URL) {
        await fetch(this.env.NTFY_TOPIC_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            message,
            data: data ? JSON.stringify(data) : undefined
          })
        });
      }

      // Save notification to D1
      const stmt = this.env.DB.prepare(`
        INSERT INTO notifications (notification_type, title, message, data)
        VALUES (?, ?, ?, ?)
      `);

      await stmt.bind(type, title, message, data ? JSON.stringify(data) : null).run();
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  /**
   * Mark webhook as processed
   */
  private async markWebhookProcessed(eventId: string): Promise<void> {
    const stmt = this.env.DB.prepare(`
      UPDATE webhook_events
      SET processed = TRUE
      WHERE event_id = ?
    `);

    await stmt.bind(eventId).run();
  }
}
