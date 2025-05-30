// netlify/functions/sms-reply.js
const { createClient } = require("@supabase/supabase-js");
const qs = require("querystring");

// Initialize Supabase client
typeof process !== "undefined" || require("dotenv").config();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
const DOMAIN = process.env.DOMAIN || "https://yourdomain.com";

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Twilio sends x-www-form-urlencoded payload
  const params = qs.parse(event.body);
  const from = params.From;
  const body = (params.Body || "").trim();

  // Expecting the user to text their 16-character code
  if (!/^[A-Za-z0-9]{16}$/.test(body)) {
    const twiml = `<Response><Message>Invalid code. Please reply with your 16-character claim code.</Message></Response>`;
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/xml" },
      body: twiml,
    };
  }
  const claimId = body;

  // Write the claim to Supabase
  const { error } = await supabase.from("claimed_rewards").insert({
    claim_id: claimId,
    phone: from,
    claimed_at: new Date().toISOString(),
  });

  let reply;
  if (error) {
    console.error("Supabase insert error:", error);
    reply = "Sorry, we could not process your claim. Please try again later.";
  } else {
    reply = `Thanks! Your claim (${claimId}) has been recorded.`;
  }

  const twiml = `<Response><Message>${reply}</Message></Response>`;
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/xml" },
    body: twiml,
  };
};
