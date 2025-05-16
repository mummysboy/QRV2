// ─── CONFIGURATION ────────────────────────────────────────────────────
const CONFIG = {
  totalSlides: 220,
  overlayStart: 50.5, // Time in seconds when overlay should appear
  frameDuration: 16, // ms per frame
  overlayAnimation: {
    fadeInDuration: 4.0,
    overlayOffset: 4.3, // Reduced from 4.3 to show earlier
    fadeInEasing: 'cubic-bezier(0.1, 0, 0.1, .3)'
  },
  logoAnimation: {
    fadeOutDuration: 0.5,
    freezeLastFrame: true
  },
  // Supabase Configuration
  supabaseUrl: 'https://luaopykuvzodhgxuthoc.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1YW9weWt1dnpvZGhneHV0aG9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyNDcyNTIsImV4cCI6MjA2MjgyMzI1Mn0.NqudqNBIt1VAB9E0-VmSEglA5z1wcLk4GMt0PVoF6Sw'
};

// ─── STATE & DOM REFS ────────────────────────────────────────────────
const state = {
  currentFrame: 0,
  isPlaying: true,
  images: [],
  supabaseClient: null,
  cardDataPromise: null, // To store the promise of the initial card data fetch
  currentCardId: null,    // To store the ID of the card currently displayed
  playAgainInterval: null, // Timer interval ID
  playAgainEndTime: null   // Timestamp for when the timer ends
};
const container = document.getElementById("slideshow-container");
const slideEl = document.getElementById("slide");
const overlayEl = document.getElementById("cardOverlay");
const headerEl = document.getElementById("cardHeader");
const addressEl = document.getElementById("cardAddress");
const addressLinkEl = document.querySelector("#cardAddress a"); // Specific element for the link
const logoEl = document.getElementById("cardLogo");
const textEl = document.getElementById("cardText"); // This is used for "Expires: ..."
const claimBtn = document.getElementById("claimBtn");
const hamburgerMenu = document.querySelector('.hamburger-menu');
const menuToggle = document.querySelector('.menu-toggle');
const subheaderEl = document.getElementById('cardSubheader');
const logoVideo = document.getElementById('logoAnimation'); // Add this if not present

// New DOM Refs for Post Submit Overlay
const postSubmitOverlayEl = document.getElementById('postSubmitOverlay');
// const rewardSentMessageEl = document.getElementById('rewardSentMessage'); // Not strictly needed if text is static
const playAgainTimerEl = document.getElementById('playAgainTimer');


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

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── SUPABASE FUNCTIONS ───────────────────────────────────────────────
function initializeSupabase() {
  // This function will now be called by waitForSupabase
  try {
    state.supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
    console.log("Supabase client initialized.");
    return true; // Indicate success
  } catch (error) {
    console.error("Error creating Supabase client:", error);
    return false; // Indicate failure
  }
}

async function waitForSupabase(timeout = 5000, interval = 100) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const checkSupabase = () => {
      if (window.supabase && typeof window.supabase.createClient === 'function') {
        if (initializeSupabase()) {
          resolve();
        } else {
          reject(new Error("Supabase client initialization failed."));
        }
      } else if (Date.now() - startTime > timeout) {
        console.error("Supabase library not found after timeout. Make sure it's loaded in your HTML.");
        reject(new Error("Supabase library loading timed out."));
      } else {
        setTimeout(checkSupabase, interval);
      }
    };
    checkSupabase();
  });
}

async function getRandomCardFromSupabase() {
  if (!state.supabaseClient) {
    console.error("Supabase client is not initialized.");
    return null;
  }

  try {
    // 1️⃣ Fetch only the IDs of cards with quantity > 0
    const { data: availableCards, error: idError } = await state.supabaseClient
      .from("cards")
      .select("cardid")
      .gt("quantity", 0); // ← filter out zero-quantity rows
    if (idError) {
      console.error("Error fetching available card IDs:", idError);
      return null;
    }
    if (!availableCards || availableCards.length === 0) {
      console.log("No in-stock cards available.");
      return null;
    }

    // 2️⃣ Pick one at random
    const randomIndex = Math.floor(Math.random() * availableCards.length);
    const randomCardIdValue = availableCards[randomIndex].cardid;

    // 3️⃣ Fetch the full card data you need
    const { data: cardData, error: cardError } = await state.supabaseClient
      .from("cards")
      .select("*")
      .eq("cardid", randomCardIdValue)
      .single();

    if (cardError) {
      console.error("Error fetching random card data:", cardError);
      return null;
    }

    return cardData;
  } catch (error) {
    console.error("Error in getRandomCardFromSupabase:", error);
    return null;
  }
}

async function populateOverlayWithData() {
  let reward = null;
  state.currentCardId = null; // Reset current card ID before fetching a new one

  if (state.cardDataPromise) {
    console.log("Using preloaded card data promise.");
    try {
      reward = await state.cardDataPromise;
    } catch (error) {
      console.error("Error awaiting preloaded card data:", error);
      reward = null;
    }
    state.cardDataPromise = null;
  } else {
    console.log("No preload promise, fetching fresh card data.");
    reward = await getRandomCardFromSupabase();
  }

  if (reward) {
    state.currentCardId = reward.cardid; // Store the ID of the displayed card
    if (logoEl) {
      logoEl.src = reward.logokey || 'assets/images/logo_placeholder.png';
    }
    if (headerEl) headerEl.textContent = reward.header || 'N/A';
    if (addressLinkEl) {
      addressLinkEl.href = reward.addressurl || '#';
      addressLinkEl.textContent = reward.addresstext || 'Address not available';
    } else if (addressEl) {
      addressEl.textContent = reward.addresstext || 'Address not available';
    }
    if (subheaderEl) {
      subheaderEl.textContent = reward.subheader || '';
      adjustSubheaderTextSize(subheaderEl); // Call the resizing function
    }
    if (textEl) textEl.textContent = reward.expires ? `Expires: ${reward.expires}` : 'Expiry not available';

    if (claimBtn) {
      claimBtn.textContent = "Claim Reward"; // Set text for available reward
    }
    console.log("Overlay populated with data:", reward);
  } else {
    if (headerEl) headerEl.textContent = 'Reward Not Available';
    if (addressLinkEl) addressLinkEl.textContent = 'Please check back later';
    else if (addressEl) addressEl.textContent = 'Please check back later';
    if (subheaderEl) subheaderEl.textContent = '';
    if (logoEl) logoEl.src = 'assets/images/logo_placeholder.png';
    if (textEl) textEl.textContent = '';

    if (claimBtn) {
      claimBtn.textContent = "Try Again"; // Set text for no reward
    }
    console.log("No reward data to populate overlay or preload failed.");
  }
}

// Function to adjust the size and spacing of the subheader text
function adjustSubheaderTextSize(element) {
  const maxIterations = 50; // Prevent infinite loops
  let iterations = 0;

  // Get the initial font size and line height
  let fontSize = parseFloat(window.getComputedStyle(element).fontSize);
  let lineHeight = parseFloat(window.getComputedStyle(element).lineHeight);

  // Reduce font size and line height until the text fits within the container
  while (element.scrollHeight > element.clientHeight && iterations < maxIterations) {
    fontSize *= 0.9963; // Reduce font size by 0.37%
    lineHeight *= 0.9963; // Reduce line height by 0.37%
    element.style.fontSize = `${fontSize}px`;
    element.style.lineHeight = `${lineHeight}px`;
    iterations++;
  }

  if (iterations >= maxIterations) {
    console.warn("Subheader text resizing reached maximum iterations.");
  }
}

// ─── UPDATE FUNCTIONS ────────────────────────────────────────────────────────
function updateTextElements(progress) {
  const oa = CONFIG.overlayAnimation;
  const e = easeInOutExpo((progress * oa.textEasing) / 5);

  const alpha = Math.min(e * oa.textFadeMultiplier, 1);
  const scale = 1 + oa.textScaleRange * e;
  const yOff = (1 - e) * -30;

  textEl.style.transform = `scale(${scale}) translateY(${yOff}px)`;
  logoEl.style.transform = `scale(${scale}) translateY(${yOff / 2}px)`;
}

function updateCardPosition() {
  const overlay = document.getElementById('cardOverlay');
  const cardFront = document.getElementById('cardFront');
  
  const centerStyles = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  };

  Object.assign(overlay.style, centerStyles, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    transform: 'translate(-50%, -50%) scale(0.9)'
  });

  if (cardFront) {
    Object.assign(cardFront.style, centerStyles);
  }
}

// ─── CLAIM BUTTON ─────────────────────────────────────────────────────
if (claimBtn) {
    claimBtn.addEventListener("click", () => {
        if (claimBtn.textContent === "Try Again") {
            location.reload(); // Reload the page
        } else if (claimBtn.textContent === "Claim Reward") {
            // Original logic to open phone popup
            const phonePopup = document.getElementById('phonePopup');
            if (phonePopup) {
                phonePopup.classList.remove('hidden');
                phonePopup.classList.add('visible');
                const phoneInput = document.getElementById('phoneInput');
                if (phoneInput) {
                    phoneInput.focus();
                }
            }
        }
    });
}

// Timer Functions
function startPlayAgainTimer() {
  if (state.playAgainInterval) {
    clearInterval(state.playAgainInterval);
  }
  state.playAgainEndTime = Date.now() + 24 * 60 * 60 * 1000; // 24 hours from now

  updatePlayAgainTimer(); // Initial display
  state.playAgainInterval = setInterval(updatePlayAgainTimer, 1000);
}

function updatePlayAgainTimer() {
  const now = Date.now();
  const timeLeft = state.playAgainEndTime - now;

  if (timeLeft <= 0) {
    clearInterval(state.playAgainInterval);
    state.playAgainInterval = null;
    if (playAgainTimerEl) playAgainTimerEl.textContent = "00:00:00";
    // Optionally, you could hide the postSubmitOverlay and show the main content again
    // or prompt the user to refresh/play again.
    // For now, it just stops at 00:00:00.
    // Example:
    // if (postSubmitOverlayEl) postSubmitOverlayEl.classList.remove('visible');
    // if (container) container.classList.remove('faded-out');
    // init(); // Or a function to reset the view to allow claiming again
    return;
  }

  const hours = Math.floor(timeLeft / (1000 * 60 * 60)); // Total hours
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  if (playAgainTimerEl) {
    playAgainTimerEl.textContent =
      `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}


const phonePopup = document.getElementById('phonePopup');
const phoneInput = document.getElementById('phoneInput');
const submitPhone = document.getElementById('submitPhone');
const cancelPhone = document.getElementById('cancelPhone');

if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
        let x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,4})/);
        e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
    });
}

if (submitPhone) {
    submitPhone.addEventListener('click', async () => {
        const phoneNumber = phoneInput.value.replace(/\D/g, '');
        if (phoneNumber.length === 10) {
            console.log('Phone number submitted:', phoneNumber);

            // Decrement quantity logic (existing)
            if (state.currentCardId && state.supabaseClient) {
                try {
                    const { data: currentCard, error: fetchError } = await state.supabaseClient
                        .from('cards')
                        .select('quantity')
                        .eq('cardid', state.currentCardId)
                        .single();

                    if (fetchError) {
                        console.error('Error fetching current card quantity:', fetchError);
                    } else if (currentCard && currentCard.quantity > 0) {
                        const newQuantity = currentCard.quantity - 1;
                        const { error: updateError } = await state.supabaseClient
                            .from('cards')
                            .update({ quantity: newQuantity })
                            .eq('cardid', state.currentCardId);
                        if (updateError) console.error('Error decrementing card quantity:', updateError);
                        else console.log(`Card ${state.currentCardId} quantity decremented to ${newQuantity}.`);
                    } else if (currentCard) {
                        console.log(`Card ${state.currentCardId} is already out of stock.`);
                    }
                } catch (e) {
                    console.error("Exception during quantity decrement:", e);
                }
            } else {
                console.warn("No currentCardId to decrement or Supabase client not ready.");
            }

            // Hide phone popup
            if (phonePopup) {
                phonePopup.classList.remove('visible');
                phonePopup.classList.add('hidden');
            }
            if (phoneInput) phoneInput.value = '';

            // Fade out main content
            if (container) {
                container.classList.add('faded-out');
            }
            // Optionally hide the claim button if it's managed separately and might reappear
            if (claimBtn) {
                claimBtn.classList.add('hidden'); // Or use opacity/visibility if it has transitions
            }

            // Make the logoAnimation video visible and play it
            if (logoVideo) {
                logoVideo.style.display = 'block'; // Or 'flex', or remove a .hidden class
                // Force a reflow before starting opacity transition for the video
                void logoVideo.offsetWidth;
                logoVideo.style.opacity = '1';
                logoVideo.currentTime = 0; // Rewind to the beginning
                logoVideo.play().catch(error => console.error("Error playing logo video:", error));
            }

            // Show the post-submit overlay with message and timer
            if (postSubmitOverlayEl) {
                postSubmitOverlayEl.classList.remove('hidden');
                void postSubmitOverlayEl.offsetWidth; // Force reflow
                postSubmitOverlayEl.classList.add('visible'); // This triggers the fade-in
                startPlayAgainTimer();
            }

            // DO NOT fetch a new reward immediately; user sees the timer screen.
            // await populateOverlayWithData(); // THIS LINE SHOULD BE REMOVED OR COMMENTED OUT

        } else {
            alert('Please enter a valid phone number');
        }
    });
}

if (cancelPhone && phonePopup && phoneInput) {
    cancelPhone.addEventListener('click', () => {
        phonePopup.classList.remove('visible');
        phonePopup.classList.add('hidden');
        phoneInput.value = '';
    });
}

if (phonePopup && phoneInput) {
    phonePopup.addEventListener('click', (e) => {
        if (e.target === phonePopup) {
            phonePopup.classList.remove('visible');
            phonePopup.classList.add('hidden');
            phoneInput.value = '';
        }
    });
}

// ─── MENU TOGGLE FUNCTIONALITY ────────────────────────────────────────
if (menuToggle && hamburgerMenu) {
    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        hamburgerMenu.classList.toggle('active');
    });
}

document.addEventListener('click', (e) => {
    if (hamburgerMenu && !hamburgerMenu.contains(e.target) && menuToggle && !menuToggle.contains(e.target)) {
        hamburgerMenu.classList.remove('active');
    }
});

document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const text = item.textContent.trim();
        let targetPopupId = null;
        let focusInputId = null;

        switch(text) {
            case 'Sign-in':
                targetPopupId = 'waitlistPopup';
                focusInputId = 'emailInput';
                break;
            case 'Advertise':
                targetPopupId = 'phonePopup';
                focusInputId = 'phoneInput';
                break;
            case 'Contact':
                targetPopupId = 'contactPopup';
                focusInputId = 'contactEmail';
                break;
        }
        
        if (targetPopupId) {
            const popup = document.getElementById(targetPopupId);
            if (popup) {
                popup.classList.remove('hidden');
                popup.classList.add('visible');
                if (focusInputId) {
                    const inputField = document.getElementById(focusInputId);
                    if (inputField) inputField.focus();
                }
            }
        }
        
        if (hamburgerMenu) hamburgerMenu.classList.remove('active');
    });
});

const popups = ['waitlistPopup', 'phonePopup', 'contactPopup'];
popups.forEach(popupId => {
    const popup = document.getElementById(popupId);
    if (popup) {
        const cancelBtn = popup.querySelector('button[id^="cancel"]');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                popup.classList.remove('visible');
                popup.classList.add('hidden');
            });
        }
        
        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                popup.classList.remove('visible');
                popup.classList.add('hidden');
            }
        });
    }
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

// ─── CONTACT POPUP FUNCTIONALITY ─────────────────────────────────────
const contactPopup = document.getElementById('contactPopup');
const contactEmail = document.getElementById('contactEmail');
const contactMessage = document.getElementById('contactMessage');
const submitContact = document.getElementById('submitContact');

if (submitContact && contactPopup && contactEmail && contactMessage) {
    submitContact.addEventListener('click', () => {
        const email = contactEmail.value;
        const message = contactMessage.value;
        
        if (validateEmail(email) && message.trim()) {
            console.log('Contact form submitted:', { email, message });
            contactPopup.classList.remove('visible');
            contactPopup.classList.add('hidden');
            contactEmail.value = '';
            contactMessage.value = '';
        } else {
            alert('Please enter a valid email and message');
        }
    });
}

// ─── SIGN-IN POPUP FUNCTIONALITY ─────────────────────────────────────
const waitlistPopup = document.getElementById('waitlistPopup');
const emailInput = document.getElementById('emailInput');
const submitWaitlist = document.getElementById('submitWaitlist');

if (submitWaitlist && waitlistPopup && emailInput) {
    submitWaitlist.addEventListener('click', () => {
        const email = emailInput.value;
        if (validateEmail(email)) {
            console.log('Waitlist email submitted:', email);
            waitlistPopup.classList.remove('visible');
            waitlistPopup.classList.add('hidden');
            emailInput.value = '';
        } else {
            alert('Please enter a valid email address');
        }
    });
}

// ─── INITIALIZATION ──────────────────────────────────────────────────
async function init() {
  try {
    await waitForSupabase(); // Wait for Supabase to be ready
    state.cardDataPromise = getRandomCardFromSupabase(); // Preload card data
    console.log("Initial card data fetch initiated.");
  } catch (error) {
    console.error("Failed to initialize Supabase:", error);
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.style.display = 'none';
    return;
  }

  const logoVideo = document.getElementById('logoAnimation');
  const mainVideo = document.getElementById('cardAnimation');
  const cardFront = document.getElementById('cardFront');
  const loadingOverlay = document.getElementById('loadingOverlay');

  try {
    await Promise.all([
      new Promise(resolve => {
        if (mainVideo) {
            mainVideo.addEventListener('loadedmetadata', resolve, { once: true });
            mainVideo.load();
        } else { resolve(); }
      }),
      new Promise(resolve => {
        if (logoVideo) {
            logoVideo.addEventListener('loadedmetadata', resolve, { once: true });
            logoVideo.load();
        } else { resolve(); }
      })
    ]);

    if (logoVideo) {
        logoVideo.playbackRate = 1.3;
        logoVideo.addEventListener('ended', () => {
            logoVideo.currentTime = logoVideo.duration - 0.001;
            logoVideo.pause();
            logoVideo.style.opacity = '1';
        }, { once: true });
    }

    if (mainVideo && logoVideo) {
        await Promise.all([
          mainVideo.play(),
          logoVideo.play()
        ]);
    } else if (mainVideo) {
        await mainVideo.play();
    } else if (logoVideo) {
        await logoVideo.play();
    }

    const videoDuration = mainVideo ? mainVideo.duration : CONFIG.overlayStart / (CONFIG.overlayAnimation.overlayOffset * 1.0);
    const overlayStartTime = videoDuration - (CONFIG.overlayAnimation.overlayOffset * 1.0);

    if (mainVideo) {
        mainVideo.addEventListener('timeupdate', async () => {
          if (mainVideo.currentTime >= overlayStartTime && overlayEl.classList.contains('hidden')) {
            await populateOverlayWithData();

            overlayEl.classList.remove('hidden');
            
            if (claimBtn) {
              claimBtn.classList.remove("hidden");
              claimBtn.style.visibility = "visible";
              setTimeout(() => {
                requestAnimationFrame(() => {
                  claimBtn.style.transition = "opacity 3s cubic-bezier(0.22, 0.61, 0.36, 1)";
                  claimBtn.style.opacity = "1";
                });
              }, 1400);
            }

            requestAnimationFrame(() => {
              overlayEl.style.position = 'fixed';
              overlayEl.style.top = '50%';
              overlayEl.style.left = '50%';
              overlayEl.style.transform = 'translate(-50%, -50%)';
              
              const smoothConfig = {
                background: `background-color 4s cubic-bezier(0.22, 0.61, 0.36, 1)`,
                opacity: `opacity 4s cubic-bezier(0.22, 0.61, 0.36, 1)`
              };
              
              overlayEl.style.transition = Object.values(smoothConfig).join(', ');
              overlayEl.style.backgroundColor = 'rgba(255, 255, 255, 0)';
              overlayEl.offsetHeight;
              
              [cardFront, textEl, headerEl, logoEl, subheaderEl, addressEl].forEach(el => {
                if (el) {
                  el.classList.remove('hidden');
                  el.style.visibility = 'visible';
                  el.style.transition = smoothConfig.opacity;
                  el.style.opacity = '0';
                  el.offsetHeight;
                }
              });
              
              requestAnimationFrame(() => {
                overlayEl.style.backgroundColor = 'rgba(255, 255, 255, 1)';
                [cardFront, textEl, headerEl, logoEl, subheaderEl, addressEl].forEach(el => {
                  if (el) el.style.opacity = '1';
                });
              });
            });
          }
        });
    } else {
        setTimeout(async () => {
            await populateOverlayWithData();
            if (overlayEl) overlayEl.classList.remove('hidden');
        }, CONFIG.overlayStart * 1000);
    }

    if (loadingOverlay) loadingOverlay.style.display = 'none';

  } catch (error) {
    console.error('Video playback or initialization failed:', error);
    if (loadingOverlay) loadingOverlay.style.display = 'none';
  }
}

window.addEventListener('load', () => {
    setTimeout(() => {
        const headerStrip = document.querySelector('.header-strip');
        const hamMenu = document.querySelector('.hamburger-menu');
        if (headerStrip) headerStrip.classList.add('visible');
        if (hamMenu) hamMenu.classList.add('visible');
    }, 100);
});

document.addEventListener('DOMContentLoaded', init);
