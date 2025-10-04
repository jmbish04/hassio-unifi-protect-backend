# Cursor Agent Instructions - UniFi Protect API Worker

## 🎯 Project Context

This is a Cloudflare Worker that provides a backend API for UniFi Protect integration with Home Assistant. The worker handles camera management, security sweeps, and provides a web dashboard.

## 🔑 Critical Authentication Pattern

**ALWAYS remember the dual API key system:**

- `PROTECT_API_KEY` → Worker authenticates with UniFi Protect API
- `WORKER_API_KEY` → Clients authenticate with this worker

## 🚨 Common Issues & Quick Fixes

### 1. API Endpoint Errors

- **Problem**: 404 errors on UniFi Protect calls
- **Solution**: Use `/protect/login` NOT `/api/auth/login`
- **Verification**: Check `https://unifi-cameras.hacolby.app/openapi.json`

### 2. Authentication Headers

- **UniFi Protect API**: Uses `x-api-key` header (NOT Bearer token)
- **Worker API**: Uses `x-api-key` header for client requests

### 3. Environment Variables

- **Required**: `PROTECT_API`, `PROTECT_API_KEY`, `WORKER_API_KEY`, `UNIFI_USERNAME`, `UNIFI_PASSWORD`
- **After changes**: Run `wrangler types` to update types

## 🔍 Debugging Checklist

1. **Run Type Checks**: `pnpm check` - catches most issues early
2. **Check API Spec**: Visit `https://unifi-cameras.hacolby.app/openapi.json`
3. **Get OpenAPI Schema**: Run `curl https://unifi-cameras.hacolby.app/openapi.json` for complete schema
4. **Verify Environment**: Check `.dev.vars` file
5. **Test Authentication**: Use curl with correct API keys
6. **Check Logs**: Look for specific error messages in wrangler output
7. **Camera Stream Issues**: Check `/ui/worker-agent-prompt` for detailed stream display instructions

## 🛠️ Development Commands

```bash
# Start development
pnpm dev

# Apply database migrations (CRITICAL for first run)
pnpm migrate:local

# Run checks (REQUIRED before committing)
pnpm check            # Run all checks (types + formatting)
pnpm check:types      # TypeScript type checking only
pnpm check:format     # Code formatting validation only
pnpm format           # Auto-fix formatting issues

# Deploy to production (runs migrations first)
pnpm deploy

# Update types after env changes
pnpm cf-typegen

# Test endpoints
curl -H "x-api-key: 6502241638" http://localhost:8787/protect/cameras
curl http://localhost:8787/agent/security_sweep
```

## ✅ Pre-Commit Requirements

**MANDATORY: Run `pnpm check` before every commit!**

This command replicates VSCode's Problems tab and catches:

- TypeScript errors in both src/ and test/ directories
- Type safety violations (e.g., 'data' is of type 'unknown')
- Code formatting issues

```bash
# The check you MUST run before committing
pnpm check

# If there are formatting issues, auto-fix them
pnpm format

# If there are type errors, fix them manually
```

**Do not commit code with type errors!** All checks must pass.

## 📁 Key Files to Focus On

- `src/index.ts` - Main worker entry point
- `src/services/protect-api.ts` - UniFi Protect integration
- `src/types.ts` - Type definitions
- `public/index.html` - Web dashboard
- `.dev.vars` - Environment configuration

## 🎥 Camera Stream Display

### Getting Stream Instructions

For detailed camera stream display and video streaming implementation instructions:

```bash
# Get comprehensive camera stream display guide
curl http://localhost:8787/ui/worker-agent-prompt
```

This provides detailed instructions for:
- **Video Streaming**: HLS and MJPEG stream implementation
- **Modal Interface**: Full-screen camera viewer modals
- **Stream URLs**: RTSP and HLS URL management and copying
- **Video.js Integration**: Professional video player setup
- **Stream Detection**: Smart detection of stream types
- **Error Handling**: Comprehensive stream failure handling

### Current Stream Features

- ✅ **Clickable Camera Grid**: Cards that open full-screen modals
- ✅ **Live Video Streaming**: HLS and MJPEG support with Video.js
- ✅ **Stream URL Copying**: One-click copying of stream URLs
- ✅ **Smart Stream Detection**: Automatic HLS vs RTSP detection
- ✅ **Responsive Design**: Mobile-optimized interface

## 🎯 Testing Strategy

1. **API Endpoints**: Test with curl first
2. **Frontend**: Use browser at `http://localhost:8787`
3. **Authentication**: Test both API key types
4. **Error Handling**: Verify graceful error responses
5. **Camera Streams**: Test modal video streaming functionality

## ⚠️ Important Reminders

- **API Spec**: Always check `https://unifi-cameras.hacolby.app/openapi.json` for current endpoints
- **OpenAPI Schema**: The complete API schema is available via `curl https://unifi-cameras.hacolby.app/openapi.json`
- **Two API Keys**: Don't confuse `PROTECT_API_KEY` vs `WORKER_API_KEY`
- **Header Format**: Use `x-api-key` not `Authorization: Bearer`
- **Error Messages**: Provide specific, actionable error messages
- **Type Safety**: Run `wrangler types` after configuration changes
- **Camera Stream Display**: Check `/ui/worker-agent-prompt` endpoint for detailed instructions on how to display camera streams and implement video streaming functionality

## 🔧 Common Fixes Applied

1. **Fixed favicon 404**: Added route handler returning 204
2. **Fixed JavaScript error**: Moved `statuses` to global scope
3. **Fixed API authentication**: Corrected API key validation logic
4. **Fixed endpoint paths**: Updated to use correct UniFi Protect endpoints
5. **Fixed error handling**: Added comprehensive error handling throughout

## 📊 Current Status

- ✅ All API endpoints working
- ✅ Authentication system functional
- ✅ Web dashboard operational
- ✅ Error handling robust
- ✅ Type definitions current

## 🚀 Next Steps for Future Development

1. Implement camera stream functionality
2. Add more security rules
3. Enhance vision analysis
4. Add more Home Assistant integrations
5. Implement real-time notifications
