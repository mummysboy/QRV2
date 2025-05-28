// netlify/functions/send-sms.js
const twilio = require("twilio");

// Initialize Twilio client
typeof process !== "undefined" || require("dotenv").config();
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { to, claimId } = body;
  if (!to || !claimId) {
    return { statusCode: 400, body: "Missing `to` or `claimId`" };
  }

  // Build verification link
  const link = `${
    process.env.DOMAIN || "https://yourdomain.com"
  }/verify?id=${claimId}`;

  try {
    await client.messages.create({
      to: to.startsWith("+") ? to : `+1${to}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      body: `Your verification link:\n${link}`,
    });
    return { statusCode: 200, body: "SMS sent" };
  } catch (err) {
    console.error("Twilio error:", err);
    return { statusCode: 500, body: "Failed to send SMS" };
  }
};
