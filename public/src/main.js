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

const { supabaseUrl, supabaseAnonKey } = window.config; // <--- PROBLEM HERE


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
  try {
    // USES THE HARDCODED CONFIG OBJECT
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
      claimBtn.textContent = "Use Reward";
      claimBtn.disabled = false;
      claimBtn.onclick = () => showUseRewardPopup(claimId); // Attach handler
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
      claimBtn.onclick = null; // Remove handler for non-claimed view
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
            // Open email popup instead of phone popup
            const emailPopup = document.getElementById('emailPopup');
            if (emailPopup) {
                emailPopup.classList.remove('hidden');
                emailPopup.classList.add('visible');
                const emailInput = document.getElementById('emailInput');
                if (emailInput) {
                    emailInput.focus();
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


const emailPopup = document.getElementById('emailPopup');
const emailInput = document.getElementById('emailInput');
const submitEmail = document.getElementById('submitEmail');
const cancelEmail = document.getElementById('cancelEmail');
const termsCheckbox = document.getElementById('termsCheckbox');
const termsNotice = document.getElementById('termsNotice');

if (termsCheckbox && submitEmail) {
  termsCheckbox.addEventListener('change', () => {
    submitEmail.disabled = !termsCheckbox.checked;
    if (termsNotice) termsNotice.style.display = 'none';
  });
}

if (submitEmail) {
    submitEmail.addEventListener('click', async () => {
        if (termsCheckbox && !termsCheckbox.checked) {
            // Show notice
            if (termsNotice) termsNotice.style.display = 'block';
            // Add shake and ring
            const termsContainer = termsCheckbox.closest('.terms-container');
            if (termsContainer) {
                termsContainer.classList.add('shake');
                setTimeout(() => termsContainer.classList.remove('shake'), 400);
            }
            termsCheckbox.classList.add('ring');
            setTimeout(() => termsCheckbox.classList.remove('ring'), 1200);

            termsCheckbox.focus();
            return; 
        }

        const emailValue = emailInput.value.trim();

        if (!validateEmail(emailValue)) {
            alert('Please enter a valid email address.');
            emailInput.focus();
            return;
        }

        // --- DECREMENT QUANTITY LOGIC ---
        if (state.currentCardId && state.supabaseClient) {
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
                    alert('Sorry, this reward is no longer available.');
                    if (emailPopup) {
                        emailPopup.classList.remove('visible');
                        emailPopup.classList.add('hidden');
                    }
                    return;
                }

                const newQuantity = currentCard.quantity - 1;
                const { error: updateError } = await state.supabaseClient
                    .from('cards')
                    .update({ quantity: newQuantity })
                    .eq('cardid', state.currentCardId);

                if (updateError) {
                    alert('There was an issue claiming the reward. Please try again.');
                    return;
                }

            } catch (e) {
                alert('An unexpected error occurred while claiming. Please try again.');
                return;
            }

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
                    alert('Something went wrong retrieving reward details for saving. Please try again.');
                    return;
                }
                cardDataForClaim = data;
            } catch (e) {
                alert('An unexpected error occurred. Please try again.');
                return;
            }

            console.log('Insert object:', {
              claim_id:    claimId,
              cardid:      cardDataForClaim.cardid,
              header:      cardDataForClaim.header,
              addresstext: cardDataForClaim.addresstext,
              addressurl:  cardDataForClaim.addressurl,
              logokey:     cardDataForClaim.logokey,
              subheader:   cardDataForClaim.subheader,
              expires:     cardDataForClaim.expires,
              email:       emailValue,
              claimed_at:  new Date().toISOString()
            });

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
                    email:       emailValue,
                    claimed_at:  new Date().toISOString()
                });

            if (insertError) {
              console.error('Supabase insert error:', insertError);
              alert('Failed to save your claim. Please try again. If the problem persists, contact support.');
              return;
            }

            // --- SEND EMAIL REWARD ---
            try {
                await fetch('https://luaopykuvzodhgxuthoc.functions.supabase.co/send-reward', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.supabaseAnonKey}`
                  },
                  body: JSON.stringify({ email: emailValue, claimId }), // <-- Pass claimId
                });
                alert('Reward sent!');
            } catch (err) {
                alert(err.message || 'An error occurred sending the reward email.');
            }

            // --- UI TRANSITION ---
            if (emailPopup) {
                emailPopup.classList.remove('visible');
                emailPopup.classList.add('hidden');
                if (emailInput) emailInput.value = ''; // Clear input
            }
            if (overlayEl) {
                overlayEl.classList.remove('visible');
                overlayEl.classList.add('hidden');
            }
            if (container) {
                container.classList.add('faded-out');
            }
            if (claimBtn) {
                claimBtn.classList.add('hidden');
            }
            if (logoVideo) {
                logoVideo.style.display = 'block';
                void logoVideo.offsetWidth;
                logoVideo.style.opacity = '1';
                logoVideo.currentTime = 0;
                logoVideo.play().catch(error => console.error("Error playing logo video:", error));
            }
            if (postSubmitOverlayEl) {
                postSubmitOverlayEl.classList.remove('hidden');
                void postSubmitOverlayEl.offsetWidth;
                postSubmitOverlayEl.classList.add('visible');
                startPlayAgainTimer();
            }
        } else {
            alert('Cannot process claim at this moment. Please ensure a reward is displayed and try again.');
        }
    });
}

if (cancelEmail && emailPopup && emailInput) {
    cancelEmail.addEventListener('click', () => {
        emailPopup.classList.remove('visible');
        emailPopup.classList.add('hidden');
        emailInput.value = '';
    });
}

if (emailPopup && emailInput) {
    emailPopup.addEventListener('click', (e) => {
        if (e.target === emailPopup) {
            emailPopup.classList.remove('visible');
            emailPopup.classList.add('hidden');
            emailInput.value = '';
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
// --- CONTACT POPUP ---
const contactMenuLink = document.getElementById('contactMenuLink');
const contactPopup = document.getElementById('contactPopup');
const closeContactPopup = document.getElementById('closeContactPopup');
const cancelContact = document.getElementById('cancelContact');
const submitContact = document.getElementById('submitContact');
const contactEmail = document.getElementById('contactEmail');
const contactMessage = document.getElementById('contactMessage');
const contactStatusMessage = document.getElementById('contactStatusMessage');
const contactFormFieldsAndButtons = [contactEmail, contactMessage, submitContact, cancelContact]; // Helper array

if (contactMenuLink) {
  contactMenuLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (contactPopup) {
      contactPopup.classList.remove('hidden');
      contactPopup.classList.add('visible');
      if (contactEmail) {
        contactEmail.focus();
      }
    }
  });
}

function closeContactForm() {
    if (contactPopup) {
        contactPopup.classList.remove('visible');
        contactPopup.classList.add('hidden');
        setTimeout(() => {
            if (contactEmail) contactEmail.value = '';
            if (contactMessage) contactMessage.value = '';
            if (contactStatusMessage) {
                contactStatusMessage.textContent = '';
                contactStatusMessage.className = 'status-message';
            }
            if (contactEmail) contactEmail.classList.remove('input-error');
            if (contactMessage) contactMessage.classList.remove('input-error');
            contactFormFieldsAndButtons.forEach(el => {
                if (el && el.style) el.style.display = '';
            });
            const buttonsContainer = document.querySelector('.contact-popup .popup-buttons');
            if (buttonsContainer && buttonsContainer.style) {
                 buttonsContainer.style.display = '';
            }
            if (submitContact) {
                submitContact.disabled = false;
                submitContact.textContent = 'Submit';
            }
        }, 600); 
    }
}

if (closeContactPopup) {
    closeContactPopup.addEventListener('click', closeContactForm);
}
if (cancelContact) {
    cancelContact.addEventListener('click', closeContactForm);
}

if (contactPopup) {
    contactPopup.addEventListener('click', (event) => {
        if (event.target === contactPopup) {
            closeContactForm();
        }
    });
}


if (submitContact) {
    submitContact.addEventListener('click', async () => {
        let isValid = true;
        if (contactStatusMessage) {
            contactStatusMessage.textContent = '';
            contactStatusMessage.className = 'status-message'; 
        }
        if (contactEmail) contactEmail.classList.remove('input-error');
        if (contactMessage) contactMessage.classList.remove('input-error');

        const emailValue = contactEmail.value.trim();
        const messageValue = contactMessage.value.trim();

        if (!emailValue) {
            contactEmail.classList.add('input-error');
            isValid = false;
        } else {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(emailValue)) {
                contactEmail.classList.add('input-error');
                if (contactStatusMessage) {
                    contactStatusMessage.textContent = 'Please enter a valid email address.';
                    contactStatusMessage.className = 'status-message error visible-message';
                }
                isValid = false;
            }
        }

        if (!messageValue) {
            contactMessage.classList.add('input-error');
            isValid = false;
        }

        if (!isValid && contactStatusMessage && !contactStatusMessage.textContent) { 
            contactStatusMessage.textContent = 'Please fill in all required fields.';
            contactStatusMessage.className = 'status-message error visible-message';
        }
        
        if (!isValid) return;

        submitContact.disabled = true;
        submitContact.textContent = 'Sending...';

        try {
            if (!state.supabaseClient) {
                throw new Error("Submission service is currently unavailable.");
            }

            // Insert into Supabase
            const { data, error } = await state.supabaseClient
                .from('contact_requests')
                .insert([
                    { email: contactEmail.value.trim(), message: contactMessage.value.trim() }
                ]);

            if (error) {
                throw new Error(error.message || 'Failed to send message. Please try again.');
            }

            // Success UI logic here (hide form, show thank you, etc.)
            if (contactEmail) contactEmail.style.display = 'none';
            if (contactMessage) contactMessage.style.display = 'none';
            const buttonsContainer = document.querySelector('.contact-popup .popup-buttons');
            if (buttonsContainer) buttonsContainer.style.display = 'none';

            if (contactStatusMessage) {
                contactStatusMessage.innerHTML = 'Message Sent! <span class="checkmark-icon">✓</span>';
                contactStatusMessage.className = 'status-message success-sent visible-message';
            }

            setTimeout(() => {
                if (contactStatusMessage) {
                    contactStatusMessage.classList.remove('visible-message'); 
                }
                setTimeout(() => {
                    closeContactForm(); 
                }, 400); 
            }, 3000); 
            // --- End Success ---

        } catch (submissionError) {
            // Show error to user
            if (contactStatusMessage) {
                contactStatusMessage.textContent = submissionError.message || 'An unexpected error occurred. Please try again.';
                contactStatusMessage.className = 'status-message error visible-message';
            }
            submitContact.disabled = false;
            submitContact.textContent = 'Submit';
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
      .single(); // 🔁 if only one result is expected
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

function showUseRewardPopup(claimId) {
  const popup = document.getElementById('useRewardPopup');
  const message = document.getElementById('useRewardMessage');
  const yesBtn = document.getElementById('useRewardYes');
  const noBtn = document.getElementById('useRewardNo');

  if (!popup || !yesBtn || !noBtn) return;

  popup.classList.remove('hidden');
  message.textContent = "Are you sure you want to use this reward?";

  // Remove previous listeners
  yesBtn.onclick = null;
  noBtn.onclick = null;

  yesBtn.onclick = async () => {
    message.textContent = "Thank you for using the reward!";
    yesBtn.style.display = "none";
    noBtn.style.display = "none";
    // Delete the row from Supabase
    if (state.supabaseClient && claimId) {
      await state.supabaseClient
        .from("claimed_rewards")
        .delete()
        .eq("claim_id", claimId);
    }
    setTimeout(() => {
      popup.classList.add('hidden');
      yesBtn.style.display = "";
      noBtn.style.display = "";
      // Optionally, you can also refresh the page or update UI here
    }, 1800);
  };

  noBtn.onclick = () => {
    popup.classList.add('hidden');
  };
}
