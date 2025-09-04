# WhatsApp API Health Monitor

A Node.js script that monitors your WhatsApp API health check endpoint and sends Slack alerts only when the service is down.

## Features

- ✅ Pings health check endpoint every 30 seconds
- 🚨 Sends detailed Slack alerts only for failures (non-200 responses)
- 📊 Failure alerts include complete request headers, response status, body, and headers
- 🔄 Handles network errors and timeouts
- 🛑 Graceful shutdown with Ctrl+C

## Requirements

- Node.js 18.0.0 or higher (uses built-in fetch API)

## Setup

1. **Check Node.js version:**

   ```bash
   node --version
   ```

   Make sure you have Node.js 18+ installed.

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure environment variables:**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` file with your actual values:

   ```env
   ENV=stage
   HEALTH_CHECK_URL=https://your-api-domain.com/health-check
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
   DEPLOYMENT_URL=https://your-deployment-server.com/api/deploy/your-deployment-id
   ```

## Usage

### Start the monitor:

```bash
node health-monitor.js
```

Or using npm script:

```bash
npm start
```

### Stop the monitor:

Press `Ctrl+C` to gracefully stop the monitoring.

## Configuration

The script uses environment variables for configuration. Create a `.env` file with the following variables:

- **HEALTH_CHECK_URL**: Your health check endpoint URL
- **SLACK_WEBHOOK_URL**: Your Slack webhook URL for notifications
- **DEPLOYMENT_URL**: Your deployment trigger URL

### Environment Variables

| Variable            | Description                               | Example                                     |
| ------------------- | ----------------------------------------- | ------------------------------------------- |
| `ENV`               | Environment identifier (stage, prod, dev) | `stage`                                     |
| `HEALTH_CHECK_URL`  | Health check endpoint to monitor          | `https://api.example.com/health`            |
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications           | `https://hooks.slack.com/services/...`      |
| `DEPLOYMENT_URL`    | Deployment trigger endpoint               | `https://deploy.example.com/api/deploy/...` |

## What happens:

1. **Every 30 seconds** the script pings your health check endpoint
2. **If status is 200:** Logs success to console only: `✅ Health check successful: 200`
3. **If status is not 200 or network error:**
   - Sends detailed Slack alert
   - Triggers auto-deployment
   - Waits 2 minutes for deployment
   - Checks health again
   - If still failing, sends deployment failure notification

## �� Sample Slack Alert:

### 🚨 Failure Alert:

```
🚨 WhatsApp API Health Check FAILED [STAGE]

Endpoint: https://sendlater-for-whatsapp-api.nhs9sl.easypanel.host/health-check
Method: GET
Environment: STAGE
Status Code: 500 Internal Server Error
Time: 2024-01-15T10:30:30.000Z

Request Headers:
User-Agent: WhatsApp-Health-Monitor/1.0
Accept: application/json, text/plain, */*

Response Body:
```

{"error": "Database connection failed"}

```

Response Headers:
content-type: application/json
content-length: 38
```

🚀 Auto-deployment will be triggered

````

## Running in Production

For production use, consider running with a process manager like PM2:

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start health-monitor.js --name "whatsapp-health-monitor"

# View logs
pm2 logs whatsapp-health-monitor

# Stop
pm2 stop whatsapp-health-monitor
````

## Sample Output

```
🔍 WhatsApp API Health Monitor Starting...
🌍 Environment: STAGE
📍 Monitoring: https://sendlater-for-whatsapp-api.nhs9sl.easypanel.host/health-check
🚀 Auto-deployment URL: https://deploy.example.com/api/deploy/...
⏰ Check interval: Every 30 seconds
📢 Slack alerts enabled for failures and deployment status
──────────────────────────────────────────────────
[2024-01-15T10:30:00.000Z] Checking health endpoint...
✅ Health check successful: 200
[2024-01-15T10:30:30.000Z] Checking health endpoint...
❌ Health check failed: 500 Internal Server Error
📨 Slack alert sent successfully
```
