import CONFIG from "./config.js";
import { ImagePreloader } from "./preloader.js";
import { OverlayMeasurer } from "./measurer.js";
import { Animator } from "./animator.js";

(async () => {
  // DOM refs
  const container = document.getElementById("slideshow-container");
  const slideEl = document.getElementById("slide");
  const overlayEl = document.getElementById("cardOverlay");
  const claimBtn = document.getElementById("claimBtn");

  // 1) preload
  const preloader = new ImagePreloader(
    CONFIG.totalSlides,
    (i) => `assets/slides/${String(i).padStart(5, "0")}.png`
  );
  const images = await preloader.preload();

  // 2) measure
  const measurer = new OverlayMeasurer(
    container,
    slideEl,
    overlayEl,
    CONFIG.overlayStart,
    CONFIG.totalSlides
  );
  const bounds = await measurer.measure(
    (i) => `assets/slides/${String(i).padStart(5, "0")}.png`
  );

  // 3) animate
  const animator = new Animator(images, bounds, CONFIG.overlayAnimation, {
    slideEl,
    overlayEl,
    claimBtn,
  });
  animator.start();
})();

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
