// ─── CONFIGURATION ────────────────────────────────────────────────────
const CONFIG = {
  totalSlides: 220,
  overlayStart: 50.5, // Time in seconds when overlay should appear
  frameDuration: 16, // ms per frame
  overlayAnimation: {
    fadeInDuration: 4.0,
    overlayOffset: 4.2,
    fadeInEasing: 'cubic-bezier(0.4, 0, 0.2, 1)'
  },
  logoAnimation: {
    fadeOutDuration: 0.5,
    freezeLastFrame: true
  }
};

// ─── STATE & DOM REFS ────────────────────────────────────────────────
const state = { currentFrame: 0, isPlaying: true, images: [] };
const container = document.getElementById("slideshow-container");
const slideEl = document.getElementById("slide");
const overlayEl = document.getElementById("cardOverlay");
const headerEl = document.getElementById("cardHeader");
const logoEl = document.getElementById("cardLogo");
const textEl = document.getElementById("cardText");
const claimBtn = document.getElementById("claimBtn");

// compute how many frames the overlay moves over
const moveFrames = CONFIG.totalSlides - CONFIG.overlayStart;

// ─── 1) Add this helper ABOVE your existing code ──────────────────────
function computeOverlayConfig() {
  const w = window.innerWidth;
  
  if (w < 360) {
    return {
      scaleStart: 0.2,
      scaleEnd:   0.8,
      textScaleRange: 0.6,
      textEasing:     2.5,
      maxWordsPerLine: 1, // Force one word per line on small screens
    };
  } else if (w < 768) {
    return {
      scaleStart: 0.3,
      scaleEnd:   0.85,
      textScaleRange: 0.7,
      textEasing:     3.0,
      maxWordsPerLine: 2,
    };
  } else {
    return {
      scaleStart: 0.33,
      scaleEnd:   0.9,
      textScaleRange: 0.8,
      textEasing:     3.5,
      maxWordsPerLine: 2,
    };
  }
}

// ─── UTILITIES ────────────────────────────────────────────────────────
function getSlideSrc(idx) {
  return `./assets/slides/${String(idx).padStart(5, "0")}.png`;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeInOutExpo(t) {
  return t === 0
    ? 0
    : t === 1
    ? 1
    : t < 0.5
    ? Math.pow(2, 20 * t - 10) / 2
    : (2 - Math.pow(2, -20 * t + 10)) / 2;
}

// ─── UPDATE FUNCTIONS ────────────────────────────────────────────────────────
function updateTextElements(progress) {
  const oa = CONFIG.overlayAnimation;
  const e = easeInOutExpo((progress * oa.textEasing) / 5);

  const alpha = Math.min(e * oa.textFadeMultiplier, 1);
  const scale = 1 + oa.textScaleRange * e;
  const yOff = (1 - e) * -30; // Reduced from -40 for subtler movement

  textEl.style.opacity = alpha;
  logoEl.style.opacity = alpha;
  textEl.style.transform = `scale(${scale}) translateY(${yOff}px)`;
  logoEl.style.transform = `scale(${scale}) translateY(${yOff / 2}px)`;
}

function updateCardPosition() {
  const overlay = document.getElementById('cardOverlay');
  const cardFront = document.getElementById('cardFront');
  
  // Center position styles
  const centerStyles = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  };

  // Apply center styles to overlay
  Object.assign(overlay.style, centerStyles, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    transform: 'translate(-50%, -50%) scale(0.9)'
  });

  // Apply center styles to card front
  Object.assign(cardFront.style, centerStyles);
}

// ─── CLAIM BUTTON ─────────────────────────────────────────────────────
claimBtn.addEventListener("click", () => {
  console.log("Claim Now clicked!");
});

// ─── ORIENTATION CHANGE HANDLER ───────────────────────────────────────
function handleOrientationChange() {
  return new Promise(resolve => {
    setTimeout(async () => {
      Object.assign(CONFIG.overlayAnimation, computeOverlayConfig());
      resolve();
    }, 100);
  });
}

// ─── INITIALIZATION ──────────────────────────────────────────────────
async function init() {
  const logoVideo = document.getElementById('logoAnimation');
  const mainVideo = document.getElementById('cardAnimation');
  const cardFront = document.getElementById('cardFront');
  const overlay = document.getElementById('cardOverlay');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const textEl = document.getElementById('cardText');
  const headerEl = document.getElementById('cardHeader');
  const logoEl = document.getElementById('cardLogo');
  const claimBtn = document.getElementById('claimBtn');

  try {
    // Load both videos first
    await Promise.all([
      new Promise(resolve => {
        mainVideo.addEventListener('loadedmetadata', resolve, { once: true });
        mainVideo.load();
      }),
      new Promise(resolve => {
        logoVideo.addEventListener('loadedmetadata', resolve, { once: true });
        logoVideo.load();
      })
    ]);

    // Configure logo video to freeze on last frame
    logoVideo.addEventListener('ended', () => {
      // Pause on the last frame
      logoVideo.currentTime = logoVideo.duration - 0.001;
      logoVideo.pause();
      // Ensure visibility
      logoVideo.style.opacity = '1';
    }, { once: true }); // Add once: true to prevent multiple triggers

    // Start both videos together
    await Promise.all([
      mainVideo.play(),
      logoVideo.play()
    ]);

    // Handle animation end and show button
    mainVideo.addEventListener('ended', () => {
      if (claimBtn) {
        claimBtn.classList.remove('hidden');
        claimBtn.style.visibility = 'visible';
        
        requestAnimationFrame(() => {
          claimBtn.style.transition = 'opacity 4s cubic-bezier(0.22, 0.61, 0.36, 1)';
          claimBtn.style.opacity = '1';
        });
      }
    });

    const videoDuration = mainVideo.duration;
    const overlayStartTime = videoDuration - (CONFIG.overlayAnimation.overlayOffset * 1.08);

    // Update the timeupdate listener
    mainVideo.addEventListener('timeupdate', () => {
      if (mainVideo.currentTime >= overlayStartTime && overlay.classList.contains('hidden')) {
        overlay.classList.remove('hidden');
        
        requestAnimationFrame(() => {
          // Set initial position
          overlay.style.position = 'fixed';
          overlay.style.top = '50%';
          overlay.style.left = '50%';
          overlay.style.transform = 'translate(-50%, -50%)';
          
          const smoothConfig = {
            background: `background-color 4s cubic-bezier(0.22, 0.61, 0.36, 1)`,
            opacity: `opacity 4s cubic-bezier(0.22, 0.61, 0.36, 1)`
          };
          
          // Apply transitions without transform
          overlay.style.transition = Object.values(smoothConfig).join(', ');
          overlay.style.backgroundColor = 'rgba(255, 255, 255, 0)';
          
          overlay.offsetHeight; // Force reflow
          
          // Show elements while maintaining position
          [cardFront, textEl, headerEl, logoEl].forEach(el => {
            if (el) {
              el.classList.remove('hidden');
              el.style.visibility = 'visible';
              el.style.transition = smoothConfig.opacity;
              el.style.opacity = '0';
              el.offsetHeight; // Force reflow
            }
          });
          
          requestAnimationFrame(() => {
            overlay.style.backgroundColor = 'rgba(255, 255, 255, 1)';
            [cardFront, textEl, headerEl, logoEl].forEach(el => {
              if (el) el.style.opacity = '1';
            });
          });
        });
      }
    });

    // Start video playback
    loadingOverlay.style.display = 'none';
    await mainVideo.play();

  } catch (error) {
    console.error('Video playback failed:', error);
  }
}

// Call init when document is ready
document.addEventListener('DOMContentLoaded', init);
