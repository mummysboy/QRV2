// netlify/functions/send-sms.js
require("dotenv").config(); // For local development, Netlify handles env vars in deployment
const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppFromNumber = process.env.TWILIO_WHATSAPP_FROM_NUMBER; // e.g., whatsapp:+14155238886
const twilioWhatsAppContentSid = process.env.TWILIO_WHATSAPP_CONTENT_SID; // Your template SID

let client;
if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
} else {
  console.error(
    "Twilio Account SID or Auth Token is missing from environment variables."
  );
}

exports.handler = async (event) => {
  console.log("[send-sms] Minimal function invoked. Method:", event.httpMethod);

  if (event.httpMethod === "OPTIONS") {
    // Handle preflight CORS requests if necessary
    return {
      statusCode: 204, // No Content
      headers: {
        "Access-Control-Allow-Origin": "*", // Adjust for your domain in production
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed. Please use POST." }),
      headers: { Allow: "POST" },
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

  if (!twilioWhatsAppFromNumber || !twilioWhatsAppContentSid) {
    console.error(
      "Twilio WhatsApp 'From' number or Content SID is missing from environment variables."
    );
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "WhatsApp configuration error on server." }),
      headers: { "Content-Type": "application/json" },
    };
  }

  try {
    // The client-side main.js sends `to` (e.g., +1xxxxxxxxxx) and `claimId`.
    // The `body` parameter from the client will be ignored for WhatsApp templates.
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

    // Format the 'To' number for WhatsApp
    const whatsappToNumber = `whatsapp:${toNumber}`; // Assumes 'toNumber' is already in E.164 like +14155551234

    // Construct ContentVariables based on your template's needs.
    // This example assumes your template uses '1' for the claimId.
    // Adjust if your template variables are different (e.g., {"customer_name": "John", "order_id": claimId})
    const contentVariables = JSON.stringify({
      "1": claimId,
      // Add other variables if your template requires them, e.g.:
      // "2": "some other value",
    });

    console.log(
      `Attempting to send WhatsApp message to: ${whatsappToNumber} from: ${twilioWhatsAppFromNumber} with ContentSid: ${twilioWhatsAppContentSid}`
    );
    console.log(`ContentVariables: ${contentVariables}`);

    const message = await client.messages.create({
      contentSid: twilioWhatsAppContentSid,
      contentVariables: contentVariables,
      from: twilioWhatsAppFromNumber,
      to: whatsappToNumber,
    });

    console.log("WhatsApp message sent successfully. SID:", message.sid);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "WhatsApp message initiated successfully.",
        sid: message.sid,
      }),
    };
  } catch (err) {
    console.error("Error sending WhatsApp message:", err);
    const errorMessage = err.message || "An internal server error occurred.";
    const errorStatus = err.status || (err.response && err.response.status) || 500;
    return {
      statusCode: errorStatus,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to send WhatsApp message.", details: errorMessage }),
    };
  }
};
