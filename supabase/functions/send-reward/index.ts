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
      html: `<p>
  🎉 <strong>Congratulations!</strong> You've successfully claimed a reward through QRewards.
</p>
<p>
  👉 <a href="${rewardLink}">Click here to view your reward</a>
</p>
<p>
  ✅ When you're ready to use it, simply show this page to the cashier or staff at checkout.
</p>
<p>
  📅 <strong>Important:</strong> Be sure to check the expiration date listed on the reward and use it before it expires.
</p>
<p>
  🙏 Thanks for participating, and enjoy your reward!
</p>
`,
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

