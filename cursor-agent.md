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

1. **Check API Spec**: Visit `https://unifi-cameras.hacolby.app/openapi.json`
2. **Verify Environment**: Check `.dev.vars` file
3. **Test Authentication**: Use curl with correct API keys
4. **Check Logs**: Look for specific error messages in wrangler output

## 🛠️ Development Commands

```bash
# Start development
pnpm dev

# Apply database migrations (CRITICAL for first run)
pnpm migrate:local

# Deploy to production (runs migrations first)
pnpm deploy

# Update types after env changes
pnpm cf-typegen

# Test endpoints
curl -H "x-api-key: 6502241638" http://localhost:8787/protect/cameras
curl http://localhost:8787/agent/security_sweep
```

## 📁 Key Files to Focus On

- `src/index.ts` - Main worker entry point
- `src/services/protect-api.ts` - UniFi Protect integration
- `src/types.ts` - Type definitions
- `public/index.html` - Web dashboard
- `.dev.vars` - Environment configuration

## 🎯 Testing Strategy

1. **API Endpoints**: Test with curl first
2. **Frontend**: Use browser at `http://localhost:8787`
3. **Authentication**: Test both API key types
4. **Error Handling**: Verify graceful error responses

## ⚠️ Important Reminders

- **API Spec**: Always check `https://unifi-cameras.hacolby.app/openapi.json` for current endpoints
- **Two API Keys**: Don't confuse `PROTECT_API_KEY` vs `WORKER_API_KEY`
- **Header Format**: Use `x-api-key` not `Authorization: Bearer`
- **Error Messages**: Provide specific, actionable error messages
- **Type Safety**: Run `wrangler types` after configuration changes

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
