# Cloudflare Workers Logging Examples

This directory contains examples for integrating Cloudflare Workers logging with various applications.

## Directory Structure

```
examples/
├── README.md                    # This file - overview of all examples
├── fastapi_example/            # FastAPI integration example
│   ├── README.md               # FastAPI-specific documentation
│   ├── cloudflare_logger.py    # Logging module for FastAPI
│   ├── main.py                 # Example FastAPI application
│   └── requirements.txt        # Python dependencies
└── fastapi-logging-example.py  # Legacy FastAPI example (deprecated - use fastapi_example/ instead)
```

## Available Examples

### FastAPI Integration (`fastapi_example/`)

A complete FastAPI application example with Cloudflare Workers logging integration.

**Features:**
- Modular logging handler
- Environment-based configuration
- Batch processing
- Error handling and retry logic
- Custom log functions
- Complete documentation

**Quick Start:**
```bash
cd fastapi_example/
pip install -r requirements.txt
export WORKER_URL=https://your-worker.workers.dev
python main.py
```

**Documentation:** See `fastapi_example/README.md` for detailed usage instructions.

### Legacy FastAPI Example (`fastapi-logging-example.py`)

⚠️ **Deprecated** - Use the `fastapi_example/` directory instead.

This is the original FastAPI example. It's kept for reference but the new modular approach in `fastapi_example/` is recommended.

## Getting Started

1. **Choose your integration method** from the examples above
2. **Set up your environment** with the required environment variables
3. **Follow the specific README** in your chosen example directory
4. **Deploy your Cloudflare Workers** with the logging endpoints enabled

## Environment Variables

All examples require the following environment variable:

| Variable | Description | Required |
|----------|-------------|----------|
| `WORKER_URL` | Your Cloudflare Workers URL | Yes |

Example:
```bash
export WORKER_URL=https://your-worker.workers.dev
```

## Cloudflare Workers Setup

Before using any examples, ensure your Cloudflare Workers has the logging endpoints deployed:

1. **Deploy the migration** to create the `log_entries` table
2. **Deploy your worker** with the logging endpoints
3. **Test the endpoints** to ensure they're working

## Support

- **FastAPI Integration**: See `fastapi_example/README.md`
- **API Documentation**: See `../LOG_ENDPOINTS.md`
- **General Issues**: Check the main project documentation

## Contributing

To add new examples:

1. Create a new directory for your integration type
2. Include a `README.md` with usage instructions
3. Add any necessary dependencies
4. Update this main README to reference your example
