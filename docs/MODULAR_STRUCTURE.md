# Modular Structure Documentation

This document describes the modular architecture of the UniFi Protect API Cloudflare Worker.

## Overview

The codebase has been refactored from a single monolithic file into a clean, modular structure that separates concerns and improves maintainability.

## Directory Structure

```
src/
├── index.ts                    # Main entry point with HTTP handlers
├── types.ts                    # TypeScript type definitions
├── integrations/
│   └── homeassistant.ts        # Home Assistant API integration
├── services/
│   ├── camera.ts              # Camera and snapshot management
│   ├── notifications.ts       # Notification services (ntfy)
│   ├── rules.ts               # Security rules engine
│   ├── security-sweep.ts      # Main security sweep orchestration
│   ├── storage.ts             # Database operations
│   └── vision.ts              # Vision analysis (HA + Workers AI)
└── utils/
    └── response.ts            # HTTP response utilities
```

## Modules

### Core Types (`types.ts`)

- Defines all TypeScript interfaces and types used throughout the application
- Includes `Env`, `SecuritySweepResult`, `Observation`, `RuleResult`, etc.

### Home Assistant Integration (`integrations/homeassistant.ts`)

- `HomeAssistantClient` class for HA API interactions
- Methods for getting states, setting input booleans, and vision analysis
- Utility function `onOff()` for parsing HA state values

### Services

#### Camera Service (`services/camera.ts`)

- `CameraService` class for camera operations
- Methods for getting camera lists and fetching/storing snapshots
- Handles Protect API integration and R2 storage

#### Vision Analysis (`services/vision.ts`)

- `VisionAnalysisService` class for image analysis
- Supports both Home Assistant vision and Workers AI
- Automatic fallback between services

#### Rules Engine (`services/rules.ts`)

- `RulesEngine` class for security rule evaluation
- Methods for rule evaluation, summarization, and boolean computation
- Configurable security rules (car + door, person at night, etc.)

#### Storage (`services/storage.ts`)

- `StorageService` class for database operations
- Methods for saving patrol runs and observations
- Handles D1 database interactions

#### Notifications (`services/notifications.ts`)

- `NotificationService` class for alerting
- Currently supports ntfy notifications
- Extensible for other notification providers

#### Security Sweep (`services/security-sweep.ts`)

- `SecuritySweepService` class that orchestrates the entire security sweep process
- Coordinates all other services
- Main business logic for the security patrol system

### Utilities (`utils/response.ts`)

- `json()` helper function for JSON responses
- Common HTTP response utilities

## Benefits of Modular Structure

1. **Separation of Concerns**: Each module has a single responsibility
2. **Testability**: Individual modules can be unit tested in isolation
3. **Maintainability**: Changes to one service don't affect others
4. **Reusability**: Services can be reused in different contexts
5. **Type Safety**: Strong TypeScript typing throughout
6. **Extensibility**: Easy to add new integrations or services

## Usage

The main `index.ts` file now simply imports the necessary services and uses them:

```typescript
import { SecuritySweepService } from './services/security-sweep.js';

// Create service instance
const securitySweep = new SecuritySweepService(env);

// Run security sweep
const result = await securitySweep.runSecuritySweep({
	trigger: 'api',
	focusCamera: 'camera1',
});
```

## Adding New Features

To add new functionality:

1. **New Integration**: Create a new file in `integrations/`
2. **New Service**: Create a new file in `services/`
3. **New Utility**: Create a new file in `utils/`
4. **Update Types**: Add new interfaces to `types.ts`
5. **Wire Together**: Update the main service classes to use new modules

This modular structure makes the codebase much more maintainable and easier to extend with new features.
