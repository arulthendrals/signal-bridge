/**
 * SIGNALBRIDGE - Operator Command Center Frontend Logic
 * Stage 0: 5-Step Pipeline Diagnostics
 * Stage 1: Continuous One-Person Live Microphone Speech-to-Text with Auto-Restart
 * Dual Mode: Live FastAPI Backend (/api/...) + Full Offline Client-side Triage Fallback
 */

const API_BASE = window.location.protocol.startsWith("http") ? "" : "http://127.0.0.1:8000";

let map = null;
let currentEmergencyMarker = null;
let sampleCallsList = [];
let landmarksList = [];
let currentVoicePrompt = "";
let currentSelectedCallIndex = 0;

// Streaming Simulation State
let streamInterval = null;
let isStreaming = false;

// Stage 1: Live Speech-to-Text State
let liveRecognition = null;
let isLiveCallActive = false;
let accumulatedFinalTranscript = "";

// -----------------------------------------------------------------------------
// EMBEDDED OFFLINE DATASETS (For zero-dependency local file execution)
// -----------------------------------------------------------------------------
const DEFAULT_SAMPLE_CALLS = [
  {
    "id": "call_cardiac_01",
    "title": "Call 1: Cardiac Arrest (English & Hindi)",
    "scenario": "Severe Chest Pain & Collapse",
    "language": "English / Hindi mix",
    "caller_name": "Rohan Malhotra",
    "caller_phone": "+91 98410 77213",
    "transcript": "Hello 108! Emergency! Please send an ambulance immediately! My uncle suddenly collapsed here at Panagal Park, T. Nagar near the bus stop. He is clutching his chest tightly and gasping for breath! Bahut pasina aa raha hai aur left arm mein heavy pain hai. He is not answering me properly, he is falling unconscious! Only 1 person is hurt, please hurry up, dil ka daura lag raha hai!",
    "expected_landmark": "panagal_park_tnagar",
    "expected_type": "CARDIAC_ARREST",
    "expected_severity": "CRITICAL"
  },
  {
    "id": "call_accident_02",
    "title": "Call 2: Road Collision (Tamil + English)",
    "scenario": "Two-Wheeler Crash on Flyover",
    "language": "Tamil + English (Tanglish)",
    "caller_name": "Senthil Nathan",
    "caller_phone": "+91 94441 88920",
    "transcript": "Aiyo sir emergency! Anna flyover kitta oru bayangaramaana bike accident! Two people fell down from the bike, bike skid aagi road divider mela crash aayiduchu. Rendu perukkum bayangarama blood flowing from leg and head. Oru aalu romba severe head injury, unconscious-aa irukkaar, moochu vida kashtapadraar! Please send 108 ambulance fast, Gemini flyover top slope!",
    "expected_landmark": "anna_flyover",
    "expected_type": "ROAD_TRAUMA",
    "expected_severity": "CRITICAL"
  },
  {
    "id": "call_fire_03",
    "title": "Call 3: Building Fire (English + Hindi)",
    "scenario": "Commercial Kitchen LPG Cylinder Explosion",
    "language": "English + Hindi mix",
    "caller_name": "Ananya Sharma",
    "caller_phone": "+91 97909 55432",
    "transcript": "Emergency! Fire, huge fire near Central Railway Station! Commercial building second floor hotel kitchen mein gas cylinder phat gaya! Huge black smoke coming out and flames are spreading to upper floors. At least 4 people are trapped inside near the fire exit crying for help! People are choking from smoke inhalation! Please send fire brigade tenders and ambulance immediately!",
    "expected_landmark": "central_railway_station",
    "expected_type": "FIRE_AND_BURNS",
    "expected_severity": "CRITICAL"
  }
];

const DEFAULT_LANDMARKS = [
  {
    "id": "anna_flyover",
    "name": "Anna Flyover (Gemini Circle), Thousand Lights, Chennai",
    "lat": 13.0532,
    "lng": 80.2520,
    "aliases": [
      "anna flyover", "gemini flyover", "gemini circle", "anna bridge",
      "anna flyover kitta", "flyover", "gemini bridge", "அண்ணா மேம்பாலம்", "फ्लाईओवर"
    ],
    "description": "Major junction connecting Mount Road and Nungambakkam"
  },
  {
    "id": "kapaleeshwarar_temple",
    "name": "Kapaleeshwarar Temple, Mylapore, Chennai",
    "lat": 13.0335,
    "lng": 80.2694,
    "aliases": [
      "kapaleeshwarar temple", "mylapore temple", "kapali kovil",
      "temple after the flyover", "temple near flyover",
      "near the temple after the flyover", "temple kitta", "kovil kitta",
      "mandir", "கோவில்", "मंदिर"
    ],
    "description": "Historic 7th-century temple in Mylapore, south of Gemini Flyover"
  },
  {
    "id": "panagal_park_tnagar",
    "name": "Panagal Park, T. Nagar, Chennai",
    "lat": 13.0416,
    "lng": 80.2337,
    "aliases": [
      "panagal park", "t nagar", "t.nagar", "thyagaraya nagar",
      "ranganathan street", "usman road", "pondy bazaar", "டி நகர்"
    ],
    "description": "Commercial shopping hub and transit center in Central Chennai"
  },
  {
    "id": "central_railway_station",
    "name": "Puratchi Thalaivar Dr. M.G. Ramachandran Central Railway Station, Chennai",
    "lat": 13.0827,
    "lng": 80.2755,
    "aliases": [
      "central railway station", "chennai central", "central station",
      "railway station", "ripon building", "park town",
      "சென்ட்ரல் ரயில் நிலையம்", "सेंट्रल रेलवे स्टेशन"
    ],
    "description": "Primary railway terminus in North Chennai with heavy public transit"
  },
  {
    "id": "kathipara_junction",
    "name": "Kathipara Cloverleaf Junction, Guindy, Chennai",
    "lat": 13.0067,
    "lng": 80.2025,
    "aliases": [
      "kathipara", "kathipara junction", "guindy flyover",
      "kathipara bridge", "guindy industrial estate", "guindy metro", "கத்திப்பாரா"
    ],
    "description": "Largest cloverleaf clover interchange in South Asia connecting GST and Inner Ring Road"
  },
  {
    "id": "marina_beach_lighthouse",
    "name": "Marina Beach Light House, Santhome, Chennai",
    "lat": 13.0399,
    "lng": 80.2790,
    "aliases": [
      "marina beach", "marina lighthouse", "light house",
      "lighthouse", "kamarajar salai", "santhome beach", "மெரினா கடற்கரை"
    ],
    "description": "Coastal public promenade along Kamarajar Salai"
  },
  {
    "id": "koyambedu_bus_stand",
    "name": "Puratchi Thalaivar Dr. MGR Bus Terminus (CMBT), Koyambedu, Chennai",
    "lat": 13.0694,
    "lng": 80.2057,
    "aliases": [
      "koyambedu bus stand", "koyambedu bus terminus", "koyambedu",
      "cmbt", "koyambedu market", "கோயம்பேடு"
    ],
    "description": "Principal inter-city bus terminus in Chennai connecting all southern districts"
  }
];

const DEFAULT_FIRST_AID = {
  "CARDIAC_ARREST": {
    "title": "CPR / Suspected Cardiac Arrest",
    "disclaimer": "VERIFY AGAINST AHA / RED CROSS GUIDELINES. Operator must confirm unconsciousness and absence of normal breathing before advising chest compressions.",
    "steps": [
      "Ensure the scene is safe for the caller and patient.",
      "Check responsiveness: Shake shoulders gently and shout 'Are you okay?'",
      "Check breathing: Look at chest for 5 to 10 seconds. If not breathing or only gasping, start CPR.",
      "Place patient flat on their back on a firm, flat surface.",
      "Place the heel of one hand on the center of the chest (lower half of breastbone). Place other hand on top, interlocking fingers.",
      "Push hard and fast: 100 to 120 compressions per minute (to the beat of 'Stayin' Alive'). Allow full chest recoil.",
      "Compress to a depth of at least 2 inches (5 cm). Do not stop until paramedics arrive or an AED is ready."
    ],
    "voice_prompt": "Place the person flat on their back. Put both hands in the center of their chest. Push down hard and fast, two times every second, until the ambulance arrives."
  },
  "SEVERE_BLEEDING": {
    "title": "Severe Bleeding & Hemorrhage Control",
    "disclaimer": "VERIFY AGAINST RED CROSS FIRST AID PROTOCOLS. Do not remove objects deeply embedded in the wound.",
    "steps": [
      "Ensure immediate scene safety and protect yourself from blood exposure if possible.",
      "Apply direct, firm pressure on the wound using a clean cloth, sterile gauze, or hands.",
      "Do not remove soaked dressings; apply additional cloths directly over existing ones.",
      "If bleeding is from an arm or leg and does not stop with direct pressure, apply an emergency tourniquet 2-3 inches above the wound (not over a joint).",
      "Keep the patient lying down, warm, and calm to prevent hemorrhagic shock."
    ],
    "voice_prompt": "Take a clean cloth or towel. Press down directly on the wound with both hands. Keep pressing firmly. Do not lift the cloth to check."
  },
  "FIRE_AND_BURNS": {
    "title": "Fire Emergency & Thermal Burn Protocol",
    "disclaimer": "VERIFY AGAINST NATIONAL FIRE PROTECTION ASSOCIATION & RED CROSS FIRST AID. Immediate evacuation takes absolute priority over first aid.",
    "steps": [
      "EVACUATE IMMEDIATELY: Get everyone out of the building. Do not use elevators.",
      "If smoke is present, stay low to the floor where air is cleaner. Cover mouth and nose with a damp cloth if available.",
      "If clothes catch fire: STOP, DROP, and ROLL.",
      "For thermal burns: Cool immediately with cool (not ice-cold) running water for at least 10 to 20 minutes.",
      "Do NOT pop blisters. Do NOT apply ice, butter, oil, or home remedies to burn wounds.",
      "Cover burns loosely with a clean, dry, non-stick cloth or sterile dressing."
    ],
    "voice_prompt": "Evacuate the building immediately. Stay low under the smoke. Once outside in fresh air, cool any burns under running tap water for ten minutes."
  },
  "ROAD_TRAUMA": {
    "title": "Road Accident / Polytrauma Protocol",
    "disclaimer": "VERIFY AGAINST ATLS (ADVANCED TRAUMA LIFE SUPPORT) BYSTANDER FIRST RESPONDER PROTOCOL. Do not move injured victims unless there is immediate danger of fire or explosion.",
    "steps": [
      "Secure the accident scene: Turn on hazard lights or place warning markers so passing vehicles do not cause secondary collisions.",
      "DO NOT MOVE the victim unless there is imminent fire or submerged water risk (suspected spinal cord injury).",
      "If a motorcycle rider is wearing a helmet, DO NOT REMOVE the helmet unless airway is completely blocked.",
      "Check airway and breathing without tilting the neck excessively (use jaw-thrust if trained).",
      "Control any major spurting bleeding with firm direct pressure.",
      "Keep the victim warm with a jacket or blanket while awaiting 108 ambulance."
    ],
    "voice_prompt": "Do not move the injured person unless there is immediate fire danger. If they are wearing a helmet, leave it on. Keep them calm and warm until the ambulance arrives."
  },
  "CHOKING": {
    "title": "Severe Airway Obstruction / Choking",
    "disclaimer": "VERIFY AGAINST RED CROSS HEIMLICH / ABDOMINAL THRUST GUIDELINES. Only intervene if the person cannot cough, speak, or breathe.",
    "steps": [
      "Ask 'Are you choking?' If they can cough forcefully or speak, encourage them to keep coughing.",
      "If victim cannot breathe, talk, or make sound: Stand behind them slightly to one side.",
      "Deliver 5 sharp back blows between shoulder blades with the heel of your hand.",
      "Perform 5 abdominal thrusts (Heimlich maneuver).",
      "Repeat 5 blows and 5 thrusts until object is expelled or person becomes unconscious."
    ],
    "voice_prompt": "Lean the person slightly forward. Give five sharp blows between their shoulder blades with the heel of your hand. If still choking, give five inward and upward abdominal thrusts."
  }
};

const EMERGENCY_KEYWORDS = {
  "CARDIAC_ARREST": [
    "heart attack", "chest pain", "cardiac", "collapsed", "unconscious",
    "dil ka daura", "seene mein dard", "nenju vali", "mayakkam",
    "breathing difficulty", "gasping", "left arm pain", "pasina", "sweating heavily",
    "pulse", "not waking up", "falling down", "fainted"
  ],
  "ROAD_TRAUMA": [
    "accident", "bike accident", "car crash", "collision", "skid", "divider",
    "hit and run", "head injury", "blood", "bleeding", "broken bone", "fracture",
    "bike skid", "road crash", "vandi muttiduchu", "rathinam", "chot",
    "haadsa", "gadi crash", "trauma", "run over"
  ],
  "FIRE_AND_BURNS": [
    "fire", "smoke", "flames", "burning", "gas cylinder", "cylinder burst",
    "explosion", "blast", "thee", "neruppu", "aag", "phat gaya",
    "fire exit", "trapped inside", "smoke inhalation", "burns", "blaze"
  ],
  "CHOKING": [
    "choking", "food stuck", "cannot breathe", "throat", "swallowed",
    "moochu muttuthu", "saans nahi aa rahi", "gala dab raha hai", "airway"
  ]
};

const CASUALTY_WORD_MAP = {
  "one": 1, "oru": 1, "ek": 1, "single": 1,
  "two": 2, "rendu": 2, "do": 2, "both": 2,
  "three": 3, "moonu": 3, "teen": 3,
  "four": 4, "naalu": 4, "char": 4,
  "five": 5, "anju": 5, "paanch": 5,
  "six": 6, "aaru": 6, "chhah": 6
};

// Catch Global JavaScript Errors for Stage 0 Diagnostics
window.addEventListener("error", (e) => {
  showDebugError(`JS Error: ${e.message} (${e.filename}:${e.lineno})`);
  setDebugStep(5, "error", "Render Error");
});

window.addEventListener("unhandledrejection", (e) => {
  showDebugError(`Unhandled Promise: ${e.reason}`);
});

document.addEventListener("DOMContentLoaded", async () => {
  initClock();
  initMap();
  await loadLandmarks();
  await loadSampleCalls();
  setupEventListeners();
  initWebSpeechAPI();

  // Load first demo scenario by default
  if (sampleCallsList.length > 0) {
    selectSampleCall(0, false);
  }
});

/**
 * --------------------------------------------------------------------------
 * STAGE 0: PIPELINE DIAGNOSTICS CONTROLLER (5 STEPS)
 * --------------------------------------------------------------------------
 */
function setDebugStep(stepNum, status, label) {
  const stepEl = document.getElementById(`step-${stepNum}`);
  if (!stepEl) return;

  stepEl.classList.remove("ok", "busy", "error");
  const dot = stepEl.querySelector(".step-dot");
  if (dot) {
    dot.className = `step-dot ${status}`;
  }

  if (status === "ok") stepEl.classList.add("ok");
  else if (status === "busy") stepEl.classList.add("busy");
  else if (status === "error") stepEl.classList.add("error");

  const statusLabel = document.getElementById("debug-status-text");
  if (statusLabel && label) {
    statusLabel.textContent = `[Step ${stepNum}] ${label}`;
  }
}

function showDebugError(msg) {
  console.error("[SignalBridge Diagnostic]", msg);
  const banner = document.getElementById("debug-error-banner");
  const textEl = document.getElementById("debug-error-text");
  if (banner && textEl) {
    banner.classList.remove("hidden");
    textEl.textContent = msg;
  }
}

function clearDebugError() {
  const banner = document.getElementById("debug-error-banner");
  if (banner) banner.classList.add("hidden");
}

/**
 * --------------------------------------------------------------------------
 * 1. LIVE TIME CLOCK
 * --------------------------------------------------------------------------
 */
function initClock() {
  const clockEl = document.getElementById("live-clock");
  if (!clockEl) return;
  function update() {
    const now = new Date();
    clockEl.textContent = now.toTimeString().split(" ")[0];
  }
  update();
  setInterval(update, 1000);
}

/**
 * --------------------------------------------------------------------------
 * 2. LEAFLET EMERGENCY MAP INITIALIZATION
 * --------------------------------------------------------------------------
 */
function initMap() {
  const defaultCenter = [13.0416, 80.2337]; // Central Chennai (Panagal Park)
  
  if (typeof L === "undefined") {
    console.warn("Leaflet library not yet loaded.");
    return;
  }

  map = L.map("emergency-map", {
    zoomControl: true,
    attributionControl: false
  }).setView(defaultCenter, 13);

  // CartoDB Dark Matter tiles
  const darkTiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    subdomains: "abcd"
  });

  darkTiles.on("tileerror", function() {
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19
    }).addTo(map);
  });

  darkTiles.addTo(map);

  const pulseIcon = L.divIcon({
    className: "custom-emergency-marker",
    html: '<div class="marker-pulse"></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });

  currentEmergencyMarker = L.marker(defaultCenter, { icon: pulseIcon }).addTo(map);
  currentEmergencyMarker.bindPopup("<b>Emergency Location</b><br>Panagal Park, T. Nagar").openPopup();
}

/**
 * --------------------------------------------------------------------------
 * 3. LOAD LANDMARKS & SAMPLE CALLS (WITH BUILT-IN FALLBACK)
 * --------------------------------------------------------------------------
 */
async function loadLandmarks() {
  try {
    const res = await fetch(`${API_BASE}/api/landmarks`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    landmarksList = await res.json();
  } catch (err) {
    console.warn("Using offline landmarks catalog:", err.message);
    landmarksList = DEFAULT_LANDMARKS;
  }
  renderLandmarkChips();
}

function renderLandmarkChips() {
  const container = document.getElementById("quick-landmark-chips");
  if (!container) return;
  container.innerHTML = "";

  landmarksList.forEach(l => {
    const pill = document.createElement("button");
    pill.className = "landmark-pill";
    pill.textContent = l.name.split(",")[0];
    pill.title = l.description || l.name;
    pill.addEventListener("click", () => {
      focusLocation(l.lat, l.lng, l.name, `Manual map navigation: ${l.name}`);
    });
    container.appendChild(pill);
  });
}

async function loadSampleCalls() {
  try {
    const res = await fetch(`${API_BASE}/api/sample-calls`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    sampleCallsList = await res.json();
  } catch (err) {
    console.warn("Using offline sample scenarios catalog:", err.message);
    sampleCallsList = DEFAULT_SAMPLE_CALLS;
  }
}

/**
 * --------------------------------------------------------------------------
 * 4. SELECT AND LOAD SAMPLE SCENARIO (DEMO PRESET)
 * --------------------------------------------------------------------------
 */
function selectSampleCall(index, autoAnalyze = true) {
  if (!sampleCallsList[index]) return;
  stopStreaming();
  if (isLiveCallActive) endLiveCall();

  currentSelectedCallIndex = index;
  const call = sampleCallsList[index];

  document.querySelectorAll(".btn-preset").forEach((b, idx) => {
    b.classList.toggle("active", idx === index);
  });

  document.getElementById("caller-name").textContent = call.caller_name || "Demo Caller";
  document.getElementById("caller-phone").textContent = call.caller_phone || "Line 108";
  document.getElementById("caller-lang").textContent = call.language || "Multi-lingual";

  // Set transcript display
  setTranscriptDisplay(call.transcript, "");

  // Diagnostics steps for sample scenario
  setDebugStep(1, "ok", "Sample Audio Ready");
  setDebugStep(2, "ok", `Sample Text Loaded (${call.transcript.split(" ").length} words)`);

  if (autoAnalyze) {
    triggerAnalysis();
  }
}

/**
 * --------------------------------------------------------------------------
 * STAGE 1: WEB SPEECH API (CONTINUOUS LIVE RECOGNITION WITH AUTO-RESTART)
 * --------------------------------------------------------------------------
 */
function initWebSpeechAPI() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    const detail = document.getElementById("mic-feedback-detail");
    if (detail) {
      detail.innerHTML = '<span style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Web Speech API not supported in this browser. Please open in Google Chrome or Microsoft Edge.</span>';
    }
    setDebugStep(1, "error", "Browser Unsupported");
    return;
  }

  liveRecognition = new SpeechRecognition();
  liveRecognition.continuous = true;       // Keep listening across pauses
  liveRecognition.interimResults = true;   // Real-time interim feedback while speaking
  liveRecognition.maxAlternatives = 1;

  const langSelect = document.getElementById("live-lang-select");
  liveRecognition.lang = langSelect ? langSelect.value : "en-IN";

  liveRecognition.onstart = () => {
    console.log("[WebSpeech] Recognition started. Lang:", liveRecognition.lang);
    setDebugStep(1, "ok", "Microphone Active");
    setDebugStep(2, "busy", "Listening for speech sounds...");

    document.getElementById("call-state-badge").textContent = "LISTENING";
    document.getElementById("call-state-badge").className = "badge badge-critical";
    document.getElementById("mic-status-label").innerHTML = '<span style="color:#10b981;">● Live Recording</span>';
    document.getElementById("mic-feedback-detail").innerHTML = 
      '<span style="color:#10b981;">● Mic open. Speak as the caller — words will stream below live!</span>';

    const indicator = document.getElementById("stream-indicator");
    indicator.className = "tag-live listening";
    indicator.innerHTML = '<i class="fa-solid fa-circle"></i> LISTENING LIVE...';
  };

  liveRecognition.onresult = (event) => {
    let interimText = "";

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const piece = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        accumulatedFinalTranscript += (accumulatedFinalTranscript ? " " : "") + piece.trim();
      } else {
        interimText += piece;
      }
    }

    // Render solid finalized text + lighter interim text
    setTranscriptDisplay(accumulatedFinalTranscript, interimText);

    // Diagnostics Step 2 (Speech text captured)
    const totalWords = (accumulatedFinalTranscript + " " + interimText).trim().split(/\s+/).filter(Boolean).length;
    setDebugStep(2, "ok", `Captured ${totalWords} words live`);
  };

  liveRecognition.onerror = (event) => {
    console.warn("[WebSpeech] Error event:", event.error);

    if (event.error === "no-speech") {
      // Normal browser silence timeout; do not terminate call
      return;
    }

    if (event.error === "not-allowed") {
      setDebugStep(1, "error", "Mic Permission Denied");
      showDebugError("Microphone permission denied! Click the lock/mic icon in Chrome's address bar, set Microphone to 'Allow', and refresh.");
      endLiveCall();
      return;
    }

    if (event.error === "network") {
      setDebugStep(2, "error", "Network Error");
      showDebugError("Speech recognition network error. Verify your internet connection.");
      return;
    }

    setDebugStep(2, "error", `Speech error: ${event.error}`);
  };

  liveRecognition.onend = () => {
    console.log("[WebSpeech] Recognition ended. Active call flag:", isLiveCallActive);
    // Key Feature: Auto-Restart! If Chrome stops on silence, restart immediately!
    if (isLiveCallActive) {
      try {
        liveRecognition.start();
        console.log("[WebSpeech] Auto-restarted continuous speech recognition.");
      } catch (err) {
        console.warn("Auto-restart notice:", err);
      }
    } else {
      setDebugStep(1, "standby", "Call Ended");
      setDebugStep(2, "standby", "Microphone Inactive");
      document.getElementById("call-state-badge").textContent = "ENDED";
      document.getElementById("call-state-badge").className = "badge badge-info";
      document.getElementById("mic-status-label").textContent = "Mic Inactive";
      document.getElementById("mic-feedback-detail").textContent = "Call ended. Operator can review notes or dispatch.";

      const indicator = document.getElementById("stream-indicator");
      indicator.className = "tag-live";
      indicator.innerHTML = '<i class="fa-solid fa-circle"></i> READY';
    }
  };
}

/**
 * --------------------------------------------------------------------------
 * 5. LIVE CALL CONTROLS: START / END CALL
 * --------------------------------------------------------------------------
 */
function startLiveCall() {
  clearDebugError();
  stopStreaming();

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("SpeechRecognition is not available in your browser. Please run SignalBridge in Google Chrome or Microsoft Edge!");
    return;
  }

  isLiveCallActive = true;
  accumulatedFinalTranscript = "";
  setTranscriptDisplay("", "");

  document.getElementById("btn-start-live-call").classList.add("hidden");
  document.getElementById("btn-end-live-call").classList.remove("hidden");

  // Read selected language from dropdown
  const langSelect = document.getElementById("live-lang-select");
  const selectedLang = langSelect ? langSelect.value : "en-IN";
  liveRecognition.lang = selectedLang;

  document.getElementById("caller-name").textContent = "Live Caller (Microphone)";
  document.getElementById("caller-phone").textContent = "Live Line 108";
  document.getElementById("caller-lang").textContent = langSelect.options[langSelect.selectedIndex].text.split("[")[0].trim();

  // Reset Stage 0 Diagnostics Steps
  setDebugStep(1, "busy", "Requesting Microphone Access...");
  setDebugStep(2, "standby", "Waiting for speech...");
  setDebugStep(3, "standby", "Waiting for analysis trigger...");
  setDebugStep(4, "standby", "Waiting for AI response...");
  setDebugStep(5, "standby", "Waiting for render...");

  try {
    liveRecognition.start();
  } catch (err) {
    console.warn("Recognition start notice:", err);
  }
}

function endLiveCall() {
  isLiveCallActive = false;

  document.getElementById("btn-start-live-call").classList.remove("hidden");
  document.getElementById("btn-end-live-call").classList.add("hidden");

  if (liveRecognition) {
    try {
      liveRecognition.stop();
    } catch (e) {
      console.warn("Notice stopping recognition:", e);
    }
  }
}

function setTranscriptDisplay(finalText, interimText) {
  const finalEl = document.getElementById("transcript-final-text");
  const interimEl = document.getElementById("transcript-interim-text");
  const placeholderEl = document.getElementById("transcript-placeholder");
  const viewerBox = document.getElementById("transcript-viewer");

  if (finalEl) finalEl.textContent = finalText;
  if (interimEl) interimEl.textContent = interimText ? (finalText ? " " : "") + interimText : "";

  if (placeholderEl) {
    placeholderEl.style.display = (finalText || interimText) ? "none" : "inline";
  }

  if (viewerBox) {
    viewerBox.scrollTop = viewerBox.scrollHeight;
  }
}

function getFullTranscriptText() {
  const finalEl = document.getElementById("transcript-final-text");
  const interimEl = document.getElementById("transcript-interim-text");
  const finalStr = finalEl ? finalEl.textContent : "";
  const interimStr = interimEl ? interimEl.textContent : "";
  return (finalStr + " " + interimStr).trim();
}

/**
 * --------------------------------------------------------------------------
 * 6. SIMULATION: WORD-BY-WORD CALL STREAMING
 * --------------------------------------------------------------------------
 */
function playSampleCallStream() {
  const call = sampleCallsList[currentSelectedCallIndex];
  if (!call) return;

  if (isLiveCallActive) endLiveCall();
  stopStreaming();
  isStreaming = true;

  setTranscriptDisplay("", "");

  const streamIndicator = document.getElementById("stream-indicator");
  streamIndicator.className = "tag-live listening";
  streamIndicator.innerHTML = '<i class="fa-solid fa-circle"></i> STREAMING SCENARIO...';

  document.getElementById("btn-play-stream").classList.add("hidden");
  document.getElementById("btn-stop-stream").classList.remove("hidden");

  const words = call.transcript.split(" ");
  let wordIndex = 0;
  let currentAccumulated = "";

  streamInterval = setInterval(() => {
    if (wordIndex < words.length) {
      const nextWord = words[wordIndex];
      currentAccumulated += (currentAccumulated ? " " : "") + nextWord;
      setTranscriptDisplay(currentAccumulated, "");
      wordIndex++;

      setDebugStep(1, "ok", "Sample Audio Stream Active");
      setDebugStep(2, "ok", `Streamed ${wordIndex}/${words.length} words`);

      const isPunctuation = nextWord.endsWith(".") || nextWord.endsWith("!") || nextWord.endsWith("?");
      if (wordIndex % 5 === 0 || isPunctuation || wordIndex === words.length) {
        triggerAnalysisSilently(currentAccumulated);
      }
    } else {
      stopStreaming();
    }
  }, 120);
}

function stopStreaming() {
  if (streamInterval) {
    clearInterval(streamInterval);
    streamInterval = null;
  }
  isStreaming = false;

  const streamIndicator = document.getElementById("stream-indicator");
  if (streamIndicator && !isLiveCallActive) {
    streamIndicator.className = "tag-live";
    streamIndicator.innerHTML = '<i class="fa-solid fa-circle"></i> READY';
  }

  const btnPlay = document.getElementById("btn-play-stream");
  const btnStop = document.getElementById("btn-stop-stream");
  if (btnPlay) btnPlay.classList.remove("hidden");
  if (btnStop) btnStop.classList.add("hidden");
}

/**
 * --------------------------------------------------------------------------
 * 7. CLIENT-SIDE EMERGENCY TRIAGE ENGINE (OFFLINE MATCHING)
 * --------------------------------------------------------------------------
 */
function clientSideExtractIncidentCard(rawTranscript, callerName = "Caller", callerPhone = "Line 108") {
  const textLower = (rawTranscript || "").toLowerCase();

  // 1. Detect Emergency Type & Keywords
  let bestType = "GENERAL_EMERGENCY";
  let maxScore = 0;
  let matchedKeywords = [];

  for (const [key, words] of Object.entries(EMERGENCY_KEYWORDS)) {
    let score = 0;
    const currentMatches = [];
    for (const kw of words) {
      if (textLower.includes(kw)) {
        score++;
        currentMatches.push(kw);
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestType = key;
      matchedKeywords = currentMatches;
    }
  }

  const displayLabels = {
    "CARDIAC_ARREST": "Cardiac Arrest / Severe Medical Emergency",
    "ROAD_TRAUMA": "High-Impact Road Crash / Polytrauma",
    "FIRE_AND_BURNS": "Structural Fire / Hazardous Blaze",
    "CHOKING": "Severe Airway Choking Incident",
    "GENERAL_EMERGENCY": "General Medical / Helpline Assistance"
  };

  // 2. Extract Casualties
  let casualtyCount = 1;
  const digitMatch = textLower.match(/(\d+)\s*(?:people|persons|victims|injured|per|aalu|log)/);
  if (digitMatch) {
    casualtyCount = parseInt(digitMatch[1], 10) || 1;
  } else {
    const atLeastMatch = textLower.match(/at least (\d+)/);
    if (atLeastMatch) {
      casualtyCount = parseInt(atLeastMatch[1], 10) || 1;
    } else {
      for (const [w, cnt] of Object.entries(CASUALTY_WORD_MAP)) {
        const regex = new RegExp(`\\b${w}\\b`);
        if (regex.test(textLower)) {
          casualtyCount = Math.max(casualtyCount, cnt);
        }
      }
    }
  }

  // 3. Severity & Responder
  const criticalTriggers = [
    "unconscious", "not breathing", "cylinder burst", "severe head injury",
    "bleeding heavily", "blood flowing", "trapped", "dil ka daura", "gasping"
  ];
  const hasCritical = criticalTriggers.some(t => textLower.includes(t));

  let severity = "MEDIUM";
  if (bestType === "CARDIAC_ARREST" || bestType === "FIRE_AND_BURNS" || hasCritical || casualtyCount >= 2) {
    severity = "CRITICAL";
  } else if (bestType === "ROAD_TRAUMA" || bestType === "CHOKING") {
    severity = "HIGH";
  }

  let suggestedResponder = "112 Integrated Emergency Response Service";
  if (bestType === "CARDIAC_ARREST") suggestedResponder = "Ambulance (108) - Advanced Life Support (ALS)";
  else if (bestType === "FIRE_AND_BURNS") suggestedResponder = "Fire & Rescue Tenders (101) + 108 Ambulance Unit";
  else if (bestType === "ROAD_TRAUMA") suggestedResponder = "108 Emergency Ambulance + 112 Traffic & Police Patrol";
  else if (bestType === "CHOKING") suggestedResponder = "Ambulance (108) - Paramedic Team";

  // 4. Resolve Landmark
  let bestLandmark = null;
  let bestAlias = "";
  let highestScore = 0;

  const catalog = (landmarksList && landmarksList.length > 0) ? landmarksList : DEFAULT_LANDMARKS;
  for (const lm of catalog) {
    for (const alias of (lm.aliases || [])) {
      const aliasLower = alias.toLowerCase();
      if (textLower.includes(aliasLower) && aliasLower.length > highestScore) {
        highestScore = aliasLower.length;
        bestLandmark = lm;
        bestAlias = alias;
      }
    }
  }

  let locationInfo;
  if (bestLandmark) {
    locationInfo = {
      resolved: true,
      id: bestLandmark.id,
      name: bestLandmark.name,
      lat: bestLandmark.lat,
      lng: bestLandmark.lng,
      description: bestLandmark.description || "",
      matched_phrase: bestAlias,
      confidence: highestScore > 8 ? 0.95 : 0.80
    };
  } else {
    locationInfo = {
      resolved: false,
      id: "unknown_location",
      name: "Location pending operator clarification",
      lat: 13.0827,
      lng: 80.2707,
      description: "Caller mentioned no known registered landmark.",
      matched_phrase: null,
      confidence: 0.20
    };
  }

  // 5. Questions
  const questionsMap = {
    "CARDIAC_ARREST": [
      "Is the patient conscious right now? Can they open their eyes or squeeze your hand?",
      "Are they breathing normally, or are they gasping / making snoring sounds?",
      "Do you have someone nearby who knows CPR, or can you put the phone on speaker?"
    ],
    "ROAD_TRAUMA": [
      "Are any victims trapped under the vehicles, or is anyone pinned down?",
      "Is anyone bleeding profusely (spurting or pooling blood)?",
      "Are the vehicles in the middle of active traffic? Is the scene safe from passing cars?"
    ],
    "FIRE_AND_BURNS": [
      "Is everyone evacuated from the building, or is anyone still trapped inside?",
      "Are there any gas cylinders, chemical storage, or electrical panels near the fire?",
      "Which floor is burning, and are stairs/exits blocked by smoke?"
    ],
    "CHOKING": [
      "Can the person cough, speak, or make any sound at all?",
      "Has the person turned blue or lost consciousness?",
      "Are you ready to perform back blows and abdominal thrusts?"
    ]
  };

  const operatorQuestions = questionsMap[bestType] || [
    "What is the exact street name or nearest building to your location?",
    "How many people need immediate medical attention?",
    "Is the patient responsive right now?"
  ];

  // 6. First Aid
  const firstAid = DEFAULT_FIRST_AID[bestType] || {
    title: "General Emergency First Response",
    disclaimer: "VERIFY AGAINST LOCAL PROTOCOLS. Keep patient safe, calm, and monitor breathing until responders arrive.",
    steps: [
      "Keep the patient calm and comfortable.",
      "Do not move the patient unless there is immediate danger.",
      "Monitor breathing and responsiveness continuously."
    ],
    voice_prompt: "Stay on the line. Help is on the way. Keep the patient comfortable and do not move them."
  };

  return {
    emergency_type: bestType,
    emergency_display: displayLabels[bestType],
    severity: severity,
    suggested_responder: suggestedResponder,
    casualty_count: casualtyCount,
    location: locationInfo,
    operator_questions: operatorQuestions,
    first_aid: firstAid,
    matched_keywords: matchedKeywords,
    caller_info: { name: callerName, phone: callerPhone },
    source: "local_triage_engine"
  };
}

/**
 * --------------------------------------------------------------------------
 * 8. TRIGGER AI ANALYSIS VIA API OR CLIENT-SIDE ENGINE
 * --------------------------------------------------------------------------
 */
async function triggerAnalysis() {
  const transcript = getFullTranscriptText();
  if (!transcript) {
    alert("Please speak or select a scenario transcript first.");
    return;
  }

  const callerName = document.getElementById("caller-name").textContent;
  const callerPhone = document.getElementById("caller-phone").textContent;

  setDebugStep(3, "busy", "Sending transcript to /api/analyze-text...");
  const btnAnalyze = document.getElementById("btn-analyze");
  btnAnalyze.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...';

  try {
    let data = null;

    // Try FastAPI backend first
    try {
      const response = await fetch(`${API_BASE}/api/analyze-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: transcript,
          caller_name: callerName,
          caller_phone: callerPhone
        })
      });

      if (response.ok) {
        data = await response.json();
        setDebugStep(3, "ok", `Sent ${transcript.length} chars (Live API)`);
        setDebugStep(4, "ok", `200 OK (${data.emergency_display})`);
      }
    } catch (netErr) {
      console.warn("Live API unreachable, activating client-side triage engine:", netErr.message);
    }

    // Seamless offline fallback if backend API is not running
    if (!data) {
      data = clientSideExtractIncidentCard(transcript, callerName, callerPhone);
      setDebugStep(3, "ok", `Processed ${transcript.length} chars (Local Triage)`);
      setDebugStep(4, "ok", `Engine Match (${data.emergency_display})`);
    }

    clearDebugError();
    updateDashboardUI(data);
    setDebugStep(5, "ok", `Card & Map Pin updated (${data.location.name.split(',')[0]})`);

  } catch (error) {
    console.error("Analysis error:", error);
    setDebugStep(3, "error", "Failed to send");
    setDebugStep(4, "error", error.message);
    showDebugError(`Analysis Error: ${error.message}`);
  } finally {
    btnAnalyze.innerHTML = '<i class="fa-solid fa-microchip"></i> Analyze Now';
  }
}

async function triggerAnalysisSilently(text) {
  if (!text || text.split(" ").length < 3) return;

  try {
    let data = null;
    try {
      const res = await fetch(`${API_BASE}/api/analyze-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text })
      });
      if (res.ok) {
        data = await res.json();
      }
    } catch (_) {}

    if (!data) {
      data = clientSideExtractIncidentCard(text);
    }

    updateDashboardUI(data);
    setDebugStep(3, "ok", "Transcript sent");
    setDebugStep(4, "ok", "Analysis updated");
    setDebugStep(5, "ok", "Card updated");
  } catch (err) {
    // Ignore silent intermediate errors
  }
}

/**
 * --------------------------------------------------------------------------
 * 9. UPDATE DASHBOARD UI WITH EXTRACTED INCIDENT CARD DATA
 * --------------------------------------------------------------------------
 */
function updateDashboardUI(data) {
  // A. Incident Type & Severity
  document.getElementById("incident-type-title").textContent = data.emergency_display;
  
  const severityBadge = document.getElementById("severity-badge");
  severityBadge.textContent = data.severity;
  severityBadge.className = "badge";
  if (data.severity === "CRITICAL") {
    severityBadge.classList.add("badge-critical");
  } else if (data.severity === "HIGH") {
    severityBadge.classList.add("badge-high");
  } else {
    severityBadge.classList.add("badge-info");
  }

  // B. Suggested Responder & Casualties
  document.getElementById("suggested-responder").textContent = data.suggested_responder;
  document.getElementById("casualty-count").textContent = 
    data.casualty_count > 1 ? `${data.casualty_count} People Injured` : "1 Person";

  // C. Keyword Chips
  const chipsContainer = document.getElementById("keyword-chips");
  chipsContainer.innerHTML = "";
  if (data.matched_keywords && data.matched_keywords.length > 0) {
    data.matched_keywords.forEach(kw => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = kw;
      chipsContainer.appendChild(chip);
    });
  } else {
    chipsContainer.innerHTML = '<span class="chip">triage rule match</span>';
  }

  // D. Operator Follow-Up Questions
  const questionsList = document.getElementById("operator-questions-list");
  questionsList.innerHTML = "";
  if (data.operator_questions && data.operator_questions.length > 0) {
    data.operator_questions.forEach(q => {
      const li = document.createElement("li");
      li.textContent = q;
      questionsList.appendChild(li);
    });
  }

  // E. First Aid Protocol
  if (data.first_aid) {
    document.getElementById("first-aid-title").textContent = data.first_aid.title;
    document.getElementById("first-aid-disclaimer").innerHTML = 
      `<i class="fa-solid fa-triangle-exclamation"></i> ${data.first_aid.disclaimer}`;

    const stepsList = document.getElementById("first-aid-steps");
    stepsList.innerHTML = "";
    (data.first_aid.steps || []).forEach(step => {
      const li = document.createElement("li");
      li.textContent = step;
      stepsList.appendChild(li);
    });

    currentVoicePrompt = data.first_aid.voice_prompt || (data.first_aid.steps || []).join(". ");
  }

  // F. Landmark Resolution and Map Pin
  if (data.location && data.location.lat && data.location.lng) {
    const loc = data.location;
    document.getElementById("landmark-name").textContent = loc.name;
    document.getElementById("landmark-coords").innerHTML = 
      `<i class="fa-solid fa-compass"></i> GPS: ${loc.lat.toFixed(4)}° N, ${loc.lng.toFixed(4)}° E`;
    
    document.getElementById("matched-phrase-text").textContent = 
      loc.matched_phrase ? `"${loc.matched_phrase}"` : "General Emergency Region";

    const confBadge = document.getElementById("landmark-confidence-badge");
    const confPct = Math.round((loc.confidence || 0.9) * 100);
    confBadge.textContent = `${confPct}% Confirmed`;

    focusLocation(loc.lat, loc.lng, loc.name, data.emergency_display);
  }
}

/**
 * --------------------------------------------------------------------------
 * 10. MAP RE-CENTERING AND POPUP
 * --------------------------------------------------------------------------
 */
function focusLocation(lat, lng, title, incidentInfo) {
  if (!map) return;
  map.flyTo([lat, lng], 15, {
    animate: true,
    duration: 1.2
  });

  if (currentEmergencyMarker) {
    currentEmergencyMarker.setLatLng([lat, lng]);
    currentEmergencyMarker.bindPopup(
      `<strong>${title}</strong><br><span style="color:#ef4444;font-weight:700;">${incidentInfo}</span>`
    ).openPopup();
  }
}

/**
 * --------------------------------------------------------------------------
 * 11. EVENT LISTENERS SETUP
 * --------------------------------------------------------------------------
 */
function setupEventListeners() {
  // Live Mic Call buttons
  const btnStartCall = document.getElementById("btn-start-live-call");
  const btnEndCall = document.getElementById("btn-end-live-call");
  if (btnStartCall) btnStartCall.addEventListener("click", startLiveCall);
  if (btnEndCall) btnEndCall.addEventListener("click", endLiveCall);

  // Language Dropdown change
  const langSelect = document.getElementById("live-lang-select");
  if (langSelect) {
    langSelect.addEventListener("change", () => {
      const selectedLang = langSelect.value;
      if (liveRecognition) {
        liveRecognition.lang = selectedLang;
      }
      document.getElementById("caller-lang").textContent = 
        langSelect.options[langSelect.selectedIndex].text.split("[")[0].trim();

      if (isLiveCallActive) {
        try {
          liveRecognition.stop();
          setTimeout(() => { if (isLiveCallActive) liveRecognition.start(); }, 150);
        } catch (e) {
          console.warn(e);
        }
      }
    });
  }

  // Preset Demo Buttons
  document.querySelectorAll(".btn-preset").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-call-idx"), 10);
      selectSampleCall(idx, true);
    });
  });

  // Play Sample Call (Word-by-word streaming effect)
  const btnPlayStream = document.getElementById("btn-play-stream");
  if (btnPlayStream) {
    btnPlayStream.addEventListener("click", playSampleCallStream);
  }

  // Stop Stream
  const btnStopStream = document.getElementById("btn-stop-stream");
  if (btnStopStream) {
    btnStopStream.addEventListener("click", stopStreaming);
  }

  // Analyze Now Button
  const btnAnalyze = document.getElementById("btn-analyze");
  if (btnAnalyze) {
    btnAnalyze.addEventListener("click", triggerAnalysis);
  }

  // Clear Button
  const btnClear = document.getElementById("btn-clear");
  if (btnClear) {
    btnClear.addEventListener("click", () => {
      stopStreaming();
      if (isLiveCallActive) endLiveCall();
      accumulatedFinalTranscript = "";
      setTranscriptDisplay("", "");
      clearDebugError();
      setDebugStep(2, "standby", "Transcript cleared");
    });
  }

  // Speak First Aid Button (Browser built-in Web Speech API)
  const btnSpeak = document.getElementById("btn-speak-firstaid");
  if (btnSpeak) {
    btnSpeak.addEventListener("click", () => {
      if (!currentVoicePrompt) {
        alert("No first-aid voice prompt available.");
        return;
      }
      speakVoiceGuidance(currentVoicePrompt);
    });
  }

  // Approve & Dispatch Button (Human-in-the-Loop)
  const btnDispatch = document.getElementById("btn-dispatch");
  if (btnDispatch) {
    btnDispatch.addEventListener("click", () => {
      const alertBox = document.getElementById("dispatch-alert");
      alertBox.classList.remove("hidden");
      alertBox.style.animation = "pulse-green 1s ease";
      setTimeout(() => {
        alertBox.classList.add("hidden");
      }, 4000);
    });
  }
}

/**
 * --------------------------------------------------------------------------
 * 12. TEXT-TO-SPEECH (Browser Native - Rs 0 cost)
 * --------------------------------------------------------------------------
 */
function speakVoiceGuidance(text) {
  if (!("speechSynthesis" in window)) {
    alert("Speech synthesis is not supported in this browser.");
    return;
  }
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const indianVoice = voices.find(v => v.lang.includes("en-IN") || v.lang.includes("hi-IN"));
  if (indianVoice) {
    utterance.voice = indianVoice;
  }

  window.speechSynthesis.speak(utterance);
}
