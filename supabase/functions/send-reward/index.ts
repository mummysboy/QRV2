// supabase/functions/send-reward/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  try {
    const { email } = await req.json();
    const rewardLink = "https://yourdomain.com/reward?id=abc123"; // Replace or generate dynamically

    const data = await resend.emails.send({
      from: "Isaac from QRewards <onboarding@resend.dev>",
      to: email,
      subject: "🎉 You’ve earned a reward!",
      html: `<p>Congrats! <a href="${rewardLink}">Click here to claim your reward</a>.</p>`,
    });

    return new Response(
      JSON.stringify({ success: true, message: "Email sent", data }),
      { status: 200 }
    );
  } catch (err) {
    console.error("Failed to send email", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 500,
      }
    );
  }
});

// Client-side code (to be used in your frontend JavaScript)
// Replace 'email' with the actual email variable from your form/input
<form id="rewardForm">
  <input type="email" id="email" placeholder="Enter your email" required />
  <button type="submit" id="claimBtn">Claim Reward</button>
</form>

<script>
  document.getElementById('rewardForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const btn = document.getElementById('claimBtn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
      const res = await fetch('https://luaopykuvzodhgxuthoc.functions.supabase.co/send-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to send reward.');
      alert(result.message || 'Reward sent!');
    } catch (err) {
      alert(err.message || 'An error occurred.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Claim Reward';
    }
  });
</script>
