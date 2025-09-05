// Load environment variables
require("dotenv").config();

const HEALTH_CHECK_URL = process.env.HEALTH_CHECK_URL;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const DEPLOYMENT_URL = process.env.DEPLOYMENT_URL;
const ENV = process.env.ENV || "dev";

// Validate required environment variables
if (!HEALTH_CHECK_URL || !SLACK_WEBHOOK_URL || !DEPLOYMENT_URL) {
  console.error("❌ Missing required environment variables:");
  if (!HEALTH_CHECK_URL) console.error("  - HEALTH_CHECK_URL");
  if (!SLACK_WEBHOOK_URL) console.error("  - SLACK_WEBHOOK_URL");
  if (!DEPLOYMENT_URL) console.error("  - DEPLOYMENT_URL");
  console.error(
    "\nPlease check your .env file and ensure all required variables are set."
  );
  process.exit(1);
}

let isDeploying = false;
let intervalId = null;

async function pingHealthCheck() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Checking health endpoint...`);

  const requestDetails = {
    method: "GET",
    url: HEALTH_CHECK_URL,
    headers: {
      "User-Agent": "WhatsApp-Health-Monitor/1.0",
      Accept: "application/json, text/plain, */*",
    },
    timeout: 10000,
  };

  try {
    const response = await fetch(HEALTH_CHECK_URL, {
      method: requestDetails.method,
      headers: requestDetails.headers,
      timeout: requestDetails.timeout,
    });

    let responseBody;
    try {
      responseBody = await response.text();
    } catch (e) {
      responseBody = "Unable to read response body";
    }

    const isSuccess = response.status === 200;

    if (isSuccess) {
      console.log(`✅ Health check successful: ${response.status}`);
      // Reset deployment flag on success
      isDeploying = false;
    } else {
      console.log(
        `❌ Health check failed: ${response.status} ${response.statusText}`
      );

      // If not already deploying, trigger deployment
      if (!isDeploying) {
        await handleFailure(requestDetails, response, responseBody);
      } else {
        // Already deployed but still failing - send deployment failure notification
        await sendDeploymentFailureNotification(
          requestDetails,
          response,
          responseBody
        );
      }
    }
  } catch (error) {
    console.log(`❌ Health check error: ${error.message}`);

    // If not already deploying, trigger deployment
    if (!isDeploying) {
      await handleFailure(requestDetails, null, error.message, error);
    } else {
      // Already deployed but still failing - send deployment failure notification
      await sendDeploymentFailureNotification(
        requestDetails,
        null,
        error.message,
        error
      );
    }
  }
}

async function handleFailure(
  requestDetails,
  response,
  responseBody,
  error = null
) {
  console.log("🚀 Triggering deployment due to failure...");
  isDeploying = true;

  // Send initial failure notification
  await sendSlackReport(requestDetails, response, responseBody, false, error);

  // Trigger deployment
  await triggerDeployment();

  // Wait 2 minutes before checking again
  console.log("⏳ Waiting 2 minutes for deployment to complete...");
  setTimeout(async () => {
    console.log("🔍 Checking health after deployment...");
    await pingHealthCheck();

    // Resume regular 30-second monitoring routine
    console.log("🔄 Resuming regular 30-second monitoring routine...");
    isDeploying = false;
  }, 120000); // 120 seconds
}

async function triggerDeployment() {
  try {
    console.log(` Calling deployment URL: ${DEPLOYMENT_URL}`);

    const deployResponse = await fetch(DEPLOYMENT_URL, {
      method: "GET",
      headers: {
        "User-Agent": "WhatsApp-Health-Monitor/1.0",
      },
      timeout: 30000, // 30 second timeout for deployment
    });

    if (deployResponse.ok) {
      console.log("✅ Deployment triggered successfully");
    } else {
      console.log(
        `❌ Deployment trigger failed: ${deployResponse.status} ${deployResponse.statusText}`
      );
    }
  } catch (error) {
    console.log(`❌ Error triggering deployment: ${error.message}`);
  }
}

async function sendDeploymentFailureNotification(
  requestDetails,
  response,
  responseBody,
  error = null
) {
  const timestamp = new Date().toISOString();

  let messageText;

  if (error) {
    messageText = `🚨 *WhatsApp API Still Down After Deployment* [${ENV.toUpperCase()}]

*Endpoint:* ${requestDetails.url}
*Method:* ${requestDetails.method}
*Environment:* ${ENV.toUpperCase()}
*Time:* ${timestamp}
*Status:* Deployment attempted but service still failing
*Error:* Network/Connection Error

*Error Details:*
\`\`\`
${responseBody}
\`\`\`

⚠️ *Action Required:* Manual intervention may be needed.`;
  } else {
    messageText = `🚨 *WhatsApp API Still Down After Deployment* [${ENV.toUpperCase()}]

*Endpoint:* ${requestDetails.url}
*Method:* ${requestDetails.method}
*Environment:* ${ENV.toUpperCase()}
*Status Code:* ${response.status} ${response.statusText}
*Time:* ${timestamp}
*Status:* Deployment attempted but service still failing

*Response Body:*
\`\`\`
${responseBody || "Empty response body"}
\`\`\`

⚠️ *Action Required:* Manual intervention may be needed.`;
  }

  const message = { text: messageText };

  try {
    const slackResponse = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (slackResponse.ok) {
      console.log(" Deployment failure notification sent to Slack");
    } else {
      const errorText = await slackResponse.text();
      console.error(
        "❌ Failed to send deployment failure notification:",
        slackResponse.status,
        errorText
      );
    }
  } catch (error) {
    console.error(
      "❌ Error sending deployment failure notification:",
      error.message
    );
  }
}

async function sendSlackReport(
  requestDetails,
  response,
  responseBody,
  isSuccess,
  error = null
) {
  const timestamp = new Date().toISOString();

  // Format request headers
  let requestHeadersText = "*Request Headers:*\n";
  for (const [key, value] of Object.entries(requestDetails.headers)) {
    requestHeadersText += `${key}: ${value}\n`;
  }

  // Format response headers
  let responseHeadersText = "";
  if (response && response.headers) {
    responseHeadersText = "\n*Response Headers:*\n";
    for (const [key, value] of response.headers.entries()) {
      responseHeadersText += `${key}: ${value}\n`;
    }
  }

  // Choose emoji and status text
  const statusEmoji = isSuccess ? "✅" : "🚨";
  const statusText = isSuccess ? "SUCCESS" : "FAILED";

  let messageText;

  if (error) {
    // Network error case
    messageText = `${statusEmoji} *WhatsApp API Health Check ${statusText}* [${ENV.toUpperCase()}]

*Endpoint:* ${requestDetails.url}
*Method:* ${requestDetails.method}
*Environment:* ${ENV.toUpperCase()}
*Time:* ${timestamp}
*Error:* Network/Connection Error

${requestHeadersText}

*Error Details:*
\`\`\`
${responseBody}
\`\`\`

🚀 *Auto-deployment will be triggered*`;
  } else {
    // Normal response case
    messageText = `${statusEmoji} *WhatsApp API Health Check ${statusText}* [${ENV.toUpperCase()}]

*Endpoint:* ${requestDetails.url}
*Method:* ${requestDetails.method}
*Environment:* ${ENV.toUpperCase()}
*Status Code:* ${response.status} ${response.statusText}
*Time:* ${timestamp}

${requestHeadersText}

*Response Body:*
\`\`\`
${responseBody || "Empty response body"}
\`\`\`${responseHeadersText}

🚀 *Auto-deployment will be triggered*`;
  }

  const message = { text: messageText };

  try {
    const slackResponse = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (slackResponse.ok) {
      console.log("📨 Slack alert sent successfully");
    } else {
      const errorText = await slackResponse.text();
      console.error(
        "❌ Failed to send Slack alert:",
        slackResponse.status,
        errorText
      );
    }
  } catch (error) {
    console.error("❌ Error sending Slack alert:", error.message);
  }
}

// Graceful shutdown handling
process.on("SIGINT", () => {
  console.log("\n🛑 Health monitor stopping...");
  if (intervalId) {
    clearInterval(intervalId);
  }
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Health monitor terminating...");
  if (intervalId) {
    clearInterval(intervalId);
  }
  process.exit(0);
});

// Start monitoring
console.log("🔍 WhatsApp API Health Monitor Starting...");
console.log(`🌍 Environment: ${ENV.toUpperCase()}`);
console.log(`📍 Monitoring: ${HEALTH_CHECK_URL}`);
console.log(`🚀 Auto-deployment URL: ${DEPLOYMENT_URL}`);
console.log("⏰ Check interval: Every 30 seconds");
console.log("📢 Slack alerts enabled for failures and deployment status");
console.log("─".repeat(50));

// Run immediately and then every 30 seconds
pingHealthCheck();
intervalId = setInterval(pingHealthCheck, 30000); // 30000 ms = 30 seconds

// Keep the process running
process.stdin.resume();
