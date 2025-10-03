# UniFi Protect API Worker - Agent Documentation

## Overview
This Cloudflare Worker provides a backend API for UniFi Protect integration with Home Assistant. It acts as a bridge between external clients and the UniFi Protect system, handling authentication, camera management, and security sweep operations.

## Architecture

### Authentication Flow
- **Worker → UniFi Protect API**: Uses `PROTECT_API_KEY` with `x-api-key` header
- **Clients → Worker API**: Uses `WORKER_API_KEY` with `x-api-key` header

### Key Services
- `ProtectApiService`: Handles UniFi Protect API communication
- `SecuritySweepService`: Manages security patrol operations
- `HomeAssistantClient`: Integrates with Home Assistant
- `VisionAnalysisService`: Processes camera images with AI
- `CameraService`: Manages camera operations
- `RulesEngine`: Evaluates security rules
- `StorageService`: Handles D1 database operations
- `NotificationService`: Sends alerts via ntfy

## API Endpoints

### Public Endpoints
- `GET /` - Serves the main dashboard
- `GET /favicon.ico` - Returns 204 No Content
- `GET /openapi.json` - API documentation

### Protected Endpoints (require WORKER_API_KEY)
- `GET /protect/cameras` - List all cameras
- `GET /protect/cameras/{id}` - Get specific camera
- `GET /protect/cameras/{id}/streams` - Get camera streams
- `POST /protect/login` - Login to UniFi Protect

### Agent Endpoints
- `GET /agent/security_sweep` - Trigger security sweep
- `POST /webhook` - Webhook for events

## Environment Variables

### Required
- `PROTECT_API`: UniFi Protect API base URL (e.g., `https://unifi-cameras.hacolby.app`)
- `PROTECT_API_KEY`: API key for UniFi Protect authentication
- `WORKER_API_KEY`: API key for client authentication with this worker
- `UNIFI_USERNAME`: UniFi Protect username
- `UNIFI_PASSWORD`: UniFi Protect password

### Optional
- `HA_BASE_URL`: Home Assistant base URL
- `HA_TOKEN`: Home Assistant long-lived token
- `HA_VISION_SERVICE`: Vision analysis service
- `NTFY_TOPIC_URL`: ntfy notification topic
- `ACCESS_CLIENT_ID`: Cloudflare Access client ID
- `ACCESS_CLIENT_SECRET`: Cloudflare Access client secret

## Database Schema (D1)

### Tables
- `patrol_runs`: Security sweep execution records
- `observations`: Individual rule evaluation results
- `camera_configs`: Camera-specific configurations

## Common Issues & Solutions

### 1. API Authentication Errors
- **401 Unauthorized**: Check `WORKER_API_KEY` for client requests
- **422 Missing x-api-key**: Ensure `PROTECT_API_KEY` is set for UniFi Protect calls

### 2. UniFi Protect API Issues
- **404 Not Found**: Verify API endpoint paths (use `/protect/login` not `/api/auth/login`)
- **500 Internal Server Error**: Check if UniFi Protect service is running

### 3. Environment Variable Issues
- Always verify `.dev.vars` file contains all required variables
- Run `wrangler types` after changing environment variables

## Development Workflow

1. **Apply Database Migrations**: `pnpm migrate:local` (CRITICAL for first run)
2. **Start Development Server**: `pnpm dev`
3. **Test Endpoints**: Use curl or the web interface
4. **Update Types**: `pnpm cf-typegen` after configuration changes
5. **Deploy**: `pnpm deploy` (automatically runs remote migrations first)

## Testing

### Manual Testing
```bash
# Test cameras endpoint
curl -H "x-api-key: 6502241638" http://localhost:8787/protect/cameras

# Test security sweep
curl http://localhost:8787/agent/security_sweep

# Test login
curl -X POST http://localhost:8787/protect/login
```

### Available Scripts
```bash
pnpm dev              # Start development server
pnpm migrate:local    # Apply migrations to local database
pnpm migrate:remote   # Apply migrations to remote database
pnpm deploy           # Deploy to production (runs migrations first)
pnpm cf-typegen       # Generate TypeScript types
pnpm test             # Run tests
pnpm test:run         # Run tests once
pnpm test:watch       # Run tests in watch mode
```

### Frontend Testing
- Navigate to `http://localhost:8787`
- Enter Worker API key: `6502241638`
- Use health check and camera sections

## Important Notes

- **API Specification**: Always check `https://unifi-cameras.hacolby.app/openapi.json` for current API endpoints
- **Authentication**: Two separate API keys serve different purposes
- **Error Handling**: All services include comprehensive error handling
- **Type Safety**: Use `wrangler types` to generate current type definitions

## File Structure
```
src/
├── index.ts                 # Main worker entry point
├── types.ts                 # TypeScript type definitions
├── services/
│   ├── protect-api.ts      # UniFi Protect API service
│   ├── security-sweep.ts   # Security patrol service
│   ├── camera.ts           # Camera management
│   ├── vision.ts           # AI vision analysis
│   ├── rules.ts            # Security rules engine
│   ├── storage.ts          # Database operations
│   └── notifications.ts    # Alert system
├── integrations/
│   └── homeassistant.ts    # Home Assistant integration
└── utils/
    └── response.ts         # Response utilities
```
