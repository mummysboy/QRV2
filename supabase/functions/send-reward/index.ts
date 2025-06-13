// supabase/functions/send-reward/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const { email, claimId } = await req.json();
    const rewardLink = `https://qrewards.netlify.app/id=${claimId}`;

    const data = await resend.emails.send({
      from: "Isaac from QRewards <onboarding@resend.dev>",
      to: email,
      subject: "🎉 You’ve earned a reward!",
      html: `<p>Congrats! <a href="${rewardLink}">Click here to claim your reward</a>.</p>`,
    });

    console.log("Resend email send result:", data);

    return new Response(
      JSON.stringify({ success: true, message: "Email sent", data }),
      { status: 200, headers: corsHeaders() }
    );
  } catch (err) {
    console.error("Failed to send email", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: corsHeaders() }
    );
  }
});

