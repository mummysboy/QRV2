// netlify/functions/send-sms.js
const twilio = require("twilio");

// It's generally recommended to initialize the client inside the handler
// or ensure env vars are loaded if initializing globally.
// For Netlify, env vars should be available globally.
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER; // Make sure this is also set

let client;
if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
} else {
  console.error("Twilio Account SID or Auth Token is missing from environment variables.");
  // Client will be undefined, and subsequent calls will fail, which should be handled.
}

exports.handler = async function (event) {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed. Please use POST." }),
      headers: { "Allow": "POST" }, // Ensure 'Allow' is a string value for the header
    };
  }

  if (!client) {
    console.error("Twilio client not initialized due to missing credentials.");
    return {
        statusCode: 500,
        body: JSON.stringify({ error: "Twilio client configuration error on server." }),
    };
  }
  if (!twilioPhoneNumber) {
    console.error("Twilio Phone Number (TWILIO_PHONE_NUMBER) is missing from environment variables.");
    return {
        statusCode: 500,
        body: JSON.stringify({ error: "Twilio 'From' number configuration error on server." }),
    };
  }

  try {
    const params = JSON.parse(event.body);
    const toPhoneNumber = params.to;
    const claimId = params.claimId;

    if (!toPhoneNumber || !claimId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing "to" or "claimId" in request body.' }),
      };
    }
    if (String(toPhoneNumber).length !== 10) { // Ensure toPhoneNumber is treated as string for length
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid phone number format. Expected 10 digits." }),
      };
    }

    const formattedToNumber = `+1${toPhoneNumber}`;
    // IMPORTANT: Update your-app-url.com to your actual application's domain
    const messageBody = `Your QRewards claim ID is ${claimId}. View it at https://your-app-url.com/id=${claimId}`; 

    console.log(`Attempting to send SMS to: ${formattedToNumber} from: ${twilioPhoneNumber} with body: ${messageBody}`);
    
    // UNCOMMENT THIS BLOCK TO SEND ACTUAL SMS
    /*
    const message = await client.messages.create({
      body: messageBody,
      from: twilioPhoneNumber, // Your Twilio phone number from env var
      to: formattedToNumber,
    });
    console.log("Twilio message sent successfully. SID:", message.sid);
    */

    // SIMULATED SUCCESS IF TWILIO BLOCK IS COMMENTED
    console.log("SMS would be sent here (Twilio call is currently simulated/commented).");
    // END SIMULATED SUCCESS

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "SMS sending process initiated successfully." }),
    };

  } catch (error) {
    console.error("Error in send-sms function:", error);
    const errorMessage = error.message || "An internal server error occurred.";
    const errorStatus = error.status || (error.response && error.response.status) || 500;

    return {
      statusCode: errorStatus,
      body: JSON.stringify({ error: "Failed to send SMS.", details: errorMessage }),
    };
  }
};
