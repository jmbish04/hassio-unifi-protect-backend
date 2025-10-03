# Documentation

This directory contains all project documentation for the UniFi Protect API Cloudflare Workers project.

## Documentation Files

### API Documentation
- **[LOG_ENDPOINTS.md](./LOG_ENDPOINTS.md)** - Complete API documentation for the logging endpoints
  - Log entry storage and retrieval
  - Authentication requirements
  - Query parameters and filtering
  - FastAPI integration examples
  - cURL examples and troubleshooting

### Project Documentation
- **[MODULAR_STRUCTURE.md](./MODULAR_STRUCTURE.md)** - Project architecture and modular structure

## Quick Navigation

### For API Users
- **Logging Integration**: See [LOG_ENDPOINTS.md](./LOG_ENDPOINTS.md)
- **FastAPI Examples**: See `../examples/fastapi_example/`

### For Developers
- **Project Structure**: See [MODULAR_STRUCTURE.md](./MODULAR_STRUCTURE.md)

### For Contributors
- **Code Organization**: See [MODULAR_STRUCTURE.md](./MODULAR_STRUCTURE.md)

## API Endpoints Overview

The project provides several API endpoints:

### Logging Endpoints
- `POST /logs` - Store log entries (no auth required)
- `GET /logs` - Retrieve log entries (auth required)
- `GET /logs/stats` - Get log statistics (auth required)
- `POST /logs/cleanup` - Manual cleanup (auth required)

### UniFi Protect Endpoints
- `GET /protect/cameras` - List cameras
- `GET /protect/cameras/{id}` - Get camera details
- `GET /protect/cameras/{id}/streams` - Get camera streams
- `GET /protect/cameras/{id}/snapshot` - Get camera snapshot
- `GET /protect/cameras/{id}/feed` - Get camera feed (live snapshots)

### Webhook Endpoints
- `POST /webhook` - Receive webhook events
- `GET /webhook/events` - Retrieve webhook events

## Getting Started

1. **Deploy the Cloudflare Worker** with the required environment variables
2. **Run the database migrations** to set up the D1 database
3. **Configure your applications** to use the logging endpoints
4. **Set up monitoring** using the provided endpoints

## Support

- **API Issues**: Check the specific endpoint documentation
- **Integration Help**: See the examples in `../examples/`
- **Development Questions**: Review the project structure documentation
