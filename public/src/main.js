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

const { supabaseUrl, supabaseAnonKey } = window.config;


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

// returns a cryptographically-strong alphanumeric string of given length
function generateClaimId(length = 16) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes)
    .map(b => alphabet[b % alphabet.length])
    .join('');
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

// MODIFIED function to adjust font size to fit width and allow specified max lines
function adjustTextToFitWidth(element, referenceWidth, maxLines = 1, minFontSize = 10, maxIterations = 50) {
  if (!element || typeof window.getComputedStyle !== 'function' || referenceWidth <= 0) {
    // console.warn("adjustTextToFitWidth: Invalid parameters.", {element, referenceWidth});
    return;
  }

  element.style.whiteSpace = 'normal'; 

  let iterations = 0;
  let currentFontSize = parseFloat(window.getComputedStyle(element).fontSize);
  
  let currentLineHeight = parseFloat(window.getComputedStyle(element).lineHeight);
  if (isNaN(currentLineHeight) || currentLineHeight === 0) { 
      currentLineHeight = currentFontSize * 1.2; 
  }
  let maxAllowedHeight = currentLineHeight * maxLines;

  while (
    (element.scrollHeight > maxAllowedHeight || element.scrollWidth > referenceWidth) && 
    currentFontSize > minFontSize && 
    iterations < maxIterations
  ) {
    currentFontSize -= 1; 
    if (currentFontSize < minFontSize) {
        currentFontSize = minFontSize;
    }
    element.style.fontSize = `${currentFontSize}px`;
    
    currentLineHeight = parseFloat(window.getComputedStyle(element).lineHeight);
    if (isNaN(currentLineHeight) || currentLineHeight === 0) {
        currentLineHeight = currentFontSize * 1.2;
    }
    maxAllowedHeight = currentLineHeight * maxLines;
    
    element.offsetHeight; 
    
    if ((element.scrollHeight <= maxAllowedHeight && element.scrollWidth <= referenceWidth) || currentFontSize === minFontSize) {
        break; 
    }
    iterations++;
  }
  
  if (iterations >= maxIterations) {
    // console.warn("Text resizing reached maximum iterations for element:", element);
  }
}

// NEW function to ensure address font is smaller than subheader font
// MODIFIED to ensure a specific pixel difference
function ensureAddressSmallerThanSubheader(addressElement, subheaderElement, minFontSize = 8, pixelDifference = 2) { // Added pixelDifference default
  if (!addressElement || !subheaderElement || !addressElement.textContent || !subheaderElement.textContent) {
    // console.warn("ensureAddressSmallerThanSubheader: Missing elements or text content.");
    return;
  }

  let addressFontSize = parseFloat(window.getComputedStyle(addressElement).fontSize);
  const subheaderFontSize = parseFloat(window.getComputedStyle(subheaderElement).fontSize);

  // Target: addressFontSize <= subheaderFontSize - pixelDifference
  // Loop if address font is not sufficiently smaller than subheader font (i.e., greater than target)
  // and can still be reduced.
  while (addressFontSize > (subheaderFontSize - pixelDifference) && addressFontSize > minFontSize) {
    addressFontSize -= 1; // Decrease by 1px
    if (addressFontSize < minFontSize) {
      addressFontSize = minFontSize; // Ensure it doesn't go below minFontSize
    }
    addressElement.style.fontSize = `${addressFontSize}px`;
    
    // Re-check condition after font size change:
    // If it's now small enough (at or below target), or hit min font size, break.
    if (addressFontSize <= (subheaderFontSize - pixelDifference) || addressFontSize === minFontSize) {
      break;
    }
  }
  // If, after the loop, the address font is still not strictly smaller than the subheader
  // (this could happen if subheaderFontSize - pixelDifference < minFontSize),
  // and the address font is equal to subheader font and can be reduced, reduce it by 1px.
  // This ensures it's at least somewhat smaller if the pixelDifference target couldn't be met.
  if (addressFontSize >= subheaderFontSize && addressFontSize > minFontSize && pixelDifference > 0) {
      addressFontSize -=1;
      if (addressFontSize < minFontSize) {
          addressFontSize = minFontSize;
      }
      addressElement.style.fontSize = `${addressFontSize}px`;
  }
}

// ─── POPULATE OVERLAY WITH DATA ────────────────────────────────────────
async function populateOverlayWithData() {
  let reward = null;
  state.currentCardId = null;

  // Check for claim ID in URL
  const claimId = getClaimIdFromUrl();
  if (claimId) {
    reward = await getClaimedRewardData(claimId);
    if (!reward) {
      // Show error if claim ID not found
      if (headerEl) headerEl.textContent = 'Invalid Claim Link';
      if (addressLinkEl) addressLinkEl.textContent = 'This claim link is not valid.';
      else if (addressEl) addressEl.textContent = 'This claim link is not valid.';
      if (subheaderEl) subheaderEl.textContent = '';
      if (logoEl) logoEl.src = 'assets/images/logo_placeholder.png';
      if (textEl) textEl.textContent = 'Please check the link or try claiming a new reward.';
      if (claimBtn) {
        claimBtn.textContent = "Invalid Link";
        claimBtn.disabled = true;
      }
      return;
    }
    state.currentCardId = reward.cardid;
    if (claimBtn) {
      claimBtn.textContent = "Reward Claimed";
      claimBtn.disabled = true;
    }
  } else {
    // Default: random card logic
    if (state.cardDataPromise) {
      try {
        reward = await state.cardDataPromise;
      } catch (error) {
        reward = null;
      }
      state.cardDataPromise = null;
    } else {
      reward = await getRandomCardFromSupabase();
    }
    if (claimBtn) {
      claimBtn.textContent = "Claim Reward";
      claimBtn.disabled = false;
    }
  }

  // Populate overlay if reward found
  if (reward) {
    state.currentCardId = reward.cardid;
    if (logoEl) logoEl.src = reward.logokey || 'assets/images/logo_placeholder.png';
    if (headerEl) headerEl.textContent = reward.header || 'N/A';
    if (addressLinkEl) {
      addressLinkEl.href = reward.addressurl || '#';
      addressLinkEl.textContent = reward.addresstext || 'Address not available';
    } else if (addressEl) {
      addressEl.textContent = reward.addresstext || 'Address not available';
    }
    if (subheaderEl) subheaderEl.textContent = reward.subheader || '';
    if (textEl) textEl.textContent = reward.expires ? `Expires: ${reward.expires}` : 'Expiry not available';
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
        const rawPhoneNumber = phoneInput.value.replace(/\D/g, ''); // Renamed to avoid confusion

        if (rawPhoneNumber.length === 10 && state.currentCardId && state.supabaseClient) {
            const formattedPhoneNumber = '+1' + rawPhoneNumber; // Add +1 prefix
            console.log('Raw phone number submitted:', rawPhoneNumber, 'Formatted:', formattedPhoneNumber, 'for cardId:', state.currentCardId);

            // --- DECREMENT QUANTITY LOGIC ---
            try {
                const { data: currentCard, error: fetchError } = await state.supabaseClient
                    .from('cards')
                    .select('quantity')
                    .eq('cardid', state.currentCardId)
                    .single();

                if (fetchError) {
                    console.error('Error fetching current card quantity:', fetchError);
                    alert('Could not verify reward availability. Please try again.');
                    return;
                }

                if (!currentCard || currentCard.quantity <= 0) {
                    console.log(`Card ${state.currentCardId} is out of stock or not found.`);
                    alert('Sorry, this reward is no longer available.');
                    if (phonePopup) {
                        phonePopup.classList.remove('visible');
                        phonePopup.classList.add('hidden');
                    }
                    return;
                }

                const newQuantity = currentCard.quantity - 1;
                const { error: updateError } = await state.supabaseClient
                    .from('cards')
                    .update({ quantity: newQuantity })
                    .eq('cardid', state.currentCardId);

                if (updateError) {
                    console.error('Error decrementing card quantity:', updateError);
                    alert('There was an issue claiming the reward. Please try again.');
                    return;
                }
                console.log(`Card ${state.currentCardId} quantity decremented to ${newQuantity}.`);

            } catch (e) {
                console.error("Exception during quantity decrement process:", e);
                alert('An unexpected error occurred while claiming. Please try again.');
                return;
            }
            // --- END DECREMENT QUANTITY LOGIC ---

            // --- NEW CLAIM RECORD ---
            const claimId = generateClaimId(16);
            let cardDataForClaim;
            try {
                const { data, error } = await state.supabaseClient
                    .from('cards')
                    .select('*')
                    .eq('cardid', state.currentCardId)
                    .single();
                if (error || !data) {
                    console.error('Failed to fetch full card data for claim record:', error);
                    alert('Something went wrong retrieving reward details for saving. Please try again.');
                    return;
                }
                cardDataForClaim = data;
            } catch (e) {
                console.error("Exception fetching full card data for claim:", e);
                alert('An unexpected error occurred. Please try again.');
                return;
            }

            const { error: insertError } = await state.supabaseClient
                .from('claimed_rewards')
                .insert({
                    claim_id:    claimId,
                    cardid:      cardDataForClaim.cardid,
                    header:      cardDataForClaim.header,
                    addresstext: cardDataForClaim.addresstext,
                    addressurl:  cardDataForClaim.addressurl,
                    logokey:     cardDataForClaim.logokey,
                    subheader:   cardDataForClaim.subheader,
                    expires:     cardDataForClaim.expires,
                    phone:       formattedPhoneNumber, // Use formattedPhoneNumber
                    claimed_at:  new Date().toISOString()
                });

            if (insertError) {
                console.error('Failed to save claim-record:', insertError);
                alert('Failed to save your claim. Please try again. If the problem persists, contact support.');
                return;
            }
            console.log('Claim record saved:', claimId);

            // --- SEND SMS ---
            fetch('/.netlify/functions/send-sms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to:       formattedPhoneNumber,  // Use formattedPhoneNumber
                claimId:  claimId
              })
            })
            .then(r => {
              if (!r.ok) {
                // Try to get more details from the response if possible
                return r.text().then(text => {
                    throw new Error(`SMS failed: ${r.status} ${r.statusText} - ${text}`);
                });
              }
              console.log('Verification SMS sent!');
              return r.json(); // Or r.text() if your function doesn't return JSON
            })
            .then(data => {
                if (data) console.log('SMS function response:', data);
            })
            .catch(err => {
              console.error('Error sending SMS:', err);
              // It's important not to block the UI transition if SMS fails,
              // but the user should be informed if critical.
              // For now, we just log it, as the primary claim is saved.
              // You might want to add a non-blocking notification later.
              // alert('Couldn’t send SMS—please try again in a moment.'); // Optional: inform user
            });
            // --- END SEND SMS ---

            // --- END NEW CLAIM RECORD ---

            // --- UI TRANSITION ---
            // Hide phone popup
            if (phonePopup) {
                phonePopup.classList.remove('visible');
                phonePopup.classList.add('hidden');
                if (phoneInput) phoneInput.value = ''; // Clear input
            }

            // Hide the main card overlay (overlayEl) explicitly
            // This ensures it's gone before the new screen elements appear.
            if (overlayEl) {
                overlayEl.classList.remove('visible'); // Remove any visibility class
                overlayEl.classList.add('hidden');   // Add class to make it display: none
            }

            // Fade out main content (slideshow-container)
            if (container) { // container is slideshow-container
                container.classList.add('faded-out'); // Assumes CSS handles the fade
            }
            // Optionally hide the claim button
            if (claimBtn) {
                claimBtn.classList.add('hidden');
            }

            // Make the logoAnimation video visible and play it
            if (logoVideo) {
                logoVideo.style.display = 'block'; // Or 'flex', or remove a .hidden class
                // If logoVideo needs to fade in, ensure its CSS has a transition for opacity.
                // The following lines will make it appear instantly or animate via CSS.
                void logoVideo.offsetWidth; // Force reflow if CSS transition for opacity exists
                logoVideo.style.opacity = '1';
                logoVideo.currentTime = 0; // Rewind to the beginning
                logoVideo.play().catch(error => console.error("Error playing logo video:", error));
            }

            // Show the post-submit overlay with message and timer
            if (postSubmitOverlayEl) {
                postSubmitOverlayEl.classList.remove('hidden'); // Make it displayable
                void postSubmitOverlayEl.offsetWidth; // Force reflow
                postSubmitOverlayEl.classList.add('visible'); // This should trigger CSS fade-in
                startPlayAgainTimer();
            }
            // --- END UI TRANSITION ---

        } else if (rawPhoneNumber.length !== 10) {
            alert('Please enter a valid 10-digit phone number.');
        } else {
            // This handles cases where currentCardId or supabaseClient might be missing
            alert('Cannot process claim at this moment. Please ensure a reward is displayed and try again.');
            console.warn('SubmitPhone pre-check failed:', {
                phoneNumberLength: rawPhoneNumber.length,
                currentCardId: state.currentCardId,
                supabaseClientReady: !!state.supabaseClient
            });
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

    // const videoDuration = mainVideo ? mainVideo.duration : CONFIG.overlayStart / (CONFIG.overlayAnimation.overlayOffset * 1.0);
    // const overlayStartTime = videoDuration - (CONFIG.overlayAnimation.overlayOffset * 1.0);

    if (mainVideo) {
        mainVideo.addEventListener('timeupdate', async () => {
          const videoDuration = mainVideo.duration;
          const overlayStartTime = videoDuration - (Number(CONFIG.overlayAnimation.overlayOffset) || 4.3);

          if (mainVideo.currentTime >= overlayStartTime && overlayEl.classList.contains('hidden')) {
            await populateOverlayWithData(); 

            overlayEl.classList.remove('hidden');
            overlayEl.offsetHeight; 

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
              
              const cardOverlayWidth = overlayEl.clientWidth; 

              const elementsToAnimate = [cardFront, textEl, headerEl, logoEl, subheaderEl, addressEl];
              elementsToAnimate.forEach(el => {
                if (el) {
                  el.classList.remove('hidden'); 
                  el.style.visibility = 'visible';
                  el.style.transition = smoothConfig.opacity;
                  el.style.opacity = '0'; 
                  el.offsetHeight; 

                  if (el === headerEl && headerEl.textContent) adjustTextToFitWidth(headerEl, cardOverlayWidth, 1); 
                  if (el === subheaderEl && subheaderEl.textContent) adjustTextToFitWidth(subheaderEl, cardOverlayWidth, 2); // Allows subheader 2 lines
                  if (el === textEl && textEl.textContent) adjustTextToFitWidth(textEl, cardOverlayWidth, 1); 
                  if (el === addressEl) {
                    if (addressLinkEl && addressEl.contains(addressLinkEl) && addressLinkEl.textContent) {
                        adjustTextToFitWidth(addressLinkEl, cardOverlayWidth, 2); 
                    } else if (addressEl.textContent) { 
                        adjustTextToFitWidth(addressEl, cardOverlayWidth, 2); 
                    }
                  }
                }
              });
              
              let targetAddressElementForComparison = null;
              if (addressLinkEl && addressEl && addressEl.contains(addressLinkEl) && addressLinkEl.textContent) {
                  targetAddressElementForComparison = addressLinkEl;
              } else if (addressEl && addressEl.textContent) {
                  targetAddressElementForComparison = addressEl;
              }
              if (targetAddressElementForComparison && subheaderEl) {
                  ensureAddressSmallerThanSubheader(targetAddressElementForComparison, subheaderEl, undefined, 8); // Increased pixelDifference to 8
              }

              requestAnimationFrame(() => {
                overlayEl.style.backgroundColor = 'rgba(255, 255, 255, 1)';
                elementsToAnimate.forEach(el => { 
                  if (el) el.style.opacity = '1';
                });
              });
            });
          }
        });
    } else { 
        setTimeout(async () => {
            await populateOverlayWithData(); 
            if (overlayEl) {
                overlayEl.classList.remove('hidden');
                overlayEl.offsetHeight; 
                const cardOverlayWidth = overlayEl.clientWidth;

                if (headerEl && headerEl.textContent) adjustTextToFitWidth(headerEl, cardOverlayWidth, 1); 
                if (subheaderEl && subheaderEl.textContent) adjustTextToFitWidth(subheaderEl, cardOverlayWidth, 2); // Changed to 2 lines for consistency
                if (textEl && textEl.textContent) adjustTextToFitWidth(textEl, cardOverlayWidth, 1); 
                
                let targetAddressElementForAdjustment = null;
                if (addressLinkEl && addressEl && addressEl.contains(addressLinkEl) && addressLinkEl.textContent) {
                    targetAddressElementForAdjustment = addressLinkEl;
                    adjustTextToFitWidth(targetAddressElementForAdjustment, cardOverlayWidth, 2);
                } else if (addressEl && addressEl.textContent) {
                    targetAddressElementForAdjustment = addressEl;
                    adjustTextToFitWidth(targetAddressElementForAdjustment, cardOverlayWidth, 2);
                }
                
                if (targetAddressElementForAdjustment && subheaderEl) {
                    ensureAddressSmallerThanSubheader(targetAddressElementForAdjustment, subheaderEl, undefined, 2); // Increased pixelDifference to 8
                }

                 [cardFront, textEl, headerEl, logoEl, subheaderEl, addressEl].forEach(el => {
                    if(el) {
                        el.style.visibility = 'visible';
                        el.style.opacity = '1';
                    }
                 });
            }
        }, (CONFIG.overlayStart || 0) * 1000);
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

// In main.js, when showing the phonePopup:
const claimForm = document.getElementById('claimForm');
if (claimForm) {
    claimForm.offerId.value = state.currentCardId; // Assuming state.currentCardId holds the correct offer ID
}

// Helper: Extract claim ID from URL (e.g. /id=xxxxxxxxxxxxxxxx at end)
function getClaimIdFromUrl() {
  const pathMatch = window.location.pathname.match(/\/id=([a-zA-Z0-9]{16})$/);
  if (pathMatch && pathMatch[1]) return pathMatch[1];
  return null;
}

// Fetch claimed reward data by claim_id from Supabase
async function getClaimedRewardData(claimId) {
  if (!state.supabaseClient) {
    console.error("Supabase client is not initialized.");
    return null;
  }
  if (!claimId) return null;
  try {
    const { data, error } = await state.supabaseClient
      .from("claimed_rewards")
      .select("*")
      .eq("claim_id", claimId)
      .single();
    if (error || !data) {
      console.warn("Claimed reward not found for claim_id:", claimId);
      return null;
    }
    return data;
  } catch (e) {
    console.error("Error fetching claimed reward:", e);
    return null;
  }
}
