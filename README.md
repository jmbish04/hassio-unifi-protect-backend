# UniFi Protect API Cloudflare Workers

A Cloudflare Workers application that provides API endpoints for UniFi Protect integration, centralized logging, and webhook processing with automatic TTL management.

## Features

- **UniFi Protect Integration** - Camera management, live feeds, and snapshots
- **Centralized Logging** - D1 database with 30-day TTL and batch processing
- **Webhook Processing** - Event handling with AI analysis capabilities
- **Security Sweep** - Automated security monitoring and patrols
- **FastAPI Integration** - Ready-to-use logging module for Python applications

## Quick Start

### 1. Deploy the Worker

```bash
# Install dependencies
npm install

# Deploy to Cloudflare Workers
npx wrangler deploy
```

### 2. Set Up Database

```bash
# Run migrations
npx wrangler d1 migrations apply your-database-name
```

### 3. Configure Environment Variables

Set up your environment variables in `wrangler.toml`:

```toml
[vars]
PROTECT_API = "https://your-unifi-protect.com"
PROTECT_API_KEY = "your-api-key"
UNIFI_USERNAME = "your-username"
UNIFI_PASSWORD = "your-password"
WORKER_API_KEY = "your-worker-api-key"
```

## Documentation

All documentation is available in the [`docs/`](./docs/) directory:

- **[API Documentation](./docs/LOG_ENDPOINTS.md)** - Complete API reference
- **[Project Structure](./docs/MODULAR_STRUCTURE.md)** - Architecture overview
- **[Agent Setup](./AGENT.md)** - Development agent configuration

## Examples

Integration examples are available in the [`examples/`](./examples/) directory:

- **[FastAPI Integration](./examples/fastapi_example/)** - Complete Python logging integration
- **[API Usage](./docs/LOG_ENDPOINTS.md#curl-examples)** - cURL examples and usage patterns

## API Endpoints

### Logging (No Auth Required for Writing)
- `POST /logs` - Store log entries
- `GET /logs` - Retrieve logs (auth required)
- `GET /logs/stats` - Get statistics (auth required)

### UniFi Protect (Auth Required)
- `GET /protect/cameras` - List cameras
- `GET /protect/cameras/{id}/streams` - Get camera streams
- `GET /protect/cameras/{id}/feed` - Live camera feed

### Webhooks
- `POST /webhook` - Receive events
- `GET /webhook/events` - Retrieve events (auth required)

## Development

### Prerequisites
- Node.js 18+
- Cloudflare account
- UniFi Protect system

### Local Development

```bash
# Install dependencies
npm install

# Start local development server
npx wrangler dev

# Run tests
npm test
```

### Database Migrations

```bash
# Apply migrations
npx wrangler d1 migrations apply your-database-name

# Create new migration
npx wrangler d1 migrations create your-database-name migration-name
```

## Project Structure

```
├── docs/                    # Documentation
├── examples/                # Integration examples
├── migrations/              # Database migrations
├── public/                  # Static assets
├── src/                     # Source code
│   ├── services/           # Business logic services
│   ├── integrations/       # External integrations
│   └── utils/              # Utility functions
└── test/                   # Test files
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

- **Documentation**: See [`docs/`](./docs/) directory
- **Examples**: See [`examples/`](./examples/) directory
- **Issues**: Create an issue in the repository
