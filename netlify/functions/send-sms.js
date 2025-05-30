// netlify/functions/send-sms.js
require("dotenv").config(); // For local development, Netlify handles env vars in deployment
const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
// TWILIO_PHONE_NUMBER is no longer directly used for sending if using Messaging Service
// const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER; 
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID; // New environment variable
const appDomain = process.env.DOMAIN || "https://your-app-url.com";

let client;
if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
} else {
  console.error(
    "Twilio Account SID or Auth Token is missing from environment variables."
  );
}

exports.handler = async (event) => {
  console.log("[send-sms] Function invoked. Method:", event.httpMethod);

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*", 
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed. Please use POST." }),
      headers: { "Content-Type": "application/json", Allow: "POST, OPTIONS" },
    };
  }

  if (!client) {
    console.error("Twilio client not initialized due to missing credentials.");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Twilio client configuration error on server." }),
      headers: { "Content-Type": "application/json" },
    };
  }

  if (!messagingServiceSid) { // Check for the Messaging Service SID
    console.error(
      "Twilio Messaging Service SID (TWILIO_MESSAGING_SERVICE_SID) is missing from environment variables."
    );
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Twilio Messaging Service configuration error on server." }),
      headers: { "Content-Type": "application/json" },
    };
  }

  try {
    const { to: toNumber, claimId } = JSON.parse(event.body); 

    if (!toNumber || !claimId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing "to" (phone number) or "claimId" in request body.',
        }),
        headers: { "Content-Type": "application/json" },
      };
    }

    const rewardUrl = `https://qrewards.netlify.app/id=${claimId}`; 
    const messageBody = `Your QRewards is ready to use. View your reward: ${rewardUrl}`;

    console.log(
      `Attempting to send SMS to: ${toNumber} using MessagingServiceSid: ${messagingServiceSid}`
    );
    console.log(`Message Body: ${messageBody}`);

    const message = await client.messages.create({
      body: messageBody,
      messagingServiceSid: messagingServiceSid, // Use Messaging Service SID here
      to: toNumber, 
    });

    console.log("SMS sent successfully. SID:", message.sid);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "SMS initiated successfully.",
        sid: message.sid,
      }),
    };
  } catch (err) {
    console.error("Error sending SMS:", err);
    const errorMessage = err.message || "An internal server error occurred.";
    const errorStatus = err.status || (err.response && err.response.status) || 500;
    return {
      statusCode: errorStatus,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to send SMS.", details: errorMessage }),
    };
  }
};
