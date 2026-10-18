"""
SignalBridge - Rule-based Keyword and Landmark Extractor
--------------------------------------------------------
Fast, deterministic emergency triage fallback supporting Tamil (Tanglish),
Hindi (Hinglish), and English keywords.
"""

import json
import os
import re
from typing import Dict, Any, List, Optional, Tuple

# Path helper for data directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")

def load_json_file(filename: str) -> Any:
    """Safely loads a JSON file from the data directory with fallback."""
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        return [] if filename.endswith("s.json") else {}
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)

# Load databases
LANDMARKS_DB = load_json_file("landmarks.json")
FIRST_AID_DB = load_json_file("first_aid.json")

# Multi-lingual keyword dictionaries
EMERGENCY_KEYWORDS = {
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
}

CASUALTY_WORD_MAP = {
    "one": 1, "oru": 1, "ek": 1, "single": 1,
    "two": 2, "rendu": 2, "do": 2, "both": 2,
    "three": 3, "moonu": 3, "teen": 3,
    "four": 4, "naalu": 4, "char": 4,
    "five": 5, "anju": 5, "paanch": 5,
    "six": 6, "aaru": 6, "chhah": 6
}

def detect_emergency_type(text_lower: str) -> Tuple[str, str, List[str]]:
    """
    Detects the emergency type and matched keywords.
    Returns: (type_key, display_label, matched_keywords)
    """
    scores = {key: 0 for key in EMERGENCY_KEYWORDS}
    matched_words = {key: [] for key in EMERGENCY_KEYWORDS}

    for key, words in EMERGENCY_KEYWORDS.items():
        for kw in words:
            if kw in text_lower:
                scores[key] += 1
                matched_words[key].append(kw)

    best_type = max(scores, key=scores.get)
    if scores[best_type] == 0:
        return "GENERAL_EMERGENCY", "General Medical / Helpline Assistance", []

    display_labels = {
        "CARDIAC_ARREST": "Cardiac Arrest / Severe Medical Emergency",
        "ROAD_TRAUMA": "High-Impact Road Crash / Polytrauma",
        "FIRE_AND_BURNS": "Structural Fire / Hazardous Blaze",
        "CHOKING": "Severe Airway Choking Incident"
    }

    return best_type, display_labels.get(best_type, "Emergency Incident"), matched_words[best_type]

def calculate_severity_and_responder(emergency_type: str, text_lower: str, casualty_count: int) -> Tuple[str, str]:
    """
    Determines severity (CRITICAL, HIGH, MEDIUM, LOW) and recommended responder.
    """
    critical_triggers = [
        "unconscious", "not breathing", "cylinder burst", "severe head injury",
        "bleeding heavily", "blood flowing", "trapped", "dil ka daura", "gasping"
    ]

    has_critical_trigger = any(t in text_lower for t in critical_triggers)

    if emergency_type == "CARDIAC_ARREST" or emergency_type == "FIRE_AND_BURNS" or has_critical_trigger or casualty_count >= 2:
        severity = "CRITICAL"
    elif emergency_type == "ROAD_TRAUMA" or emergency_type == "CHOKING":
        severity = "HIGH"
    else:
        severity = "MEDIUM"

    # Recommended Responders
    if emergency_type == "CARDIAC_ARREST":
        responder = "Ambulance (108) - Advanced Life Support (ALS)"
    elif emergency_type == "FIRE_AND_BURNS":
        responder = "Fire & Rescue Tenders (101) + 108 Ambulance Unit"
    elif emergency_type == "ROAD_TRAUMA":
        responder = "108 Emergency Ambulance + 112 Traffic & Police Patrol"
    elif emergency_type == "CHOKING":
        responder = "Ambulance (108) - Paramedic Team"
    else:
        responder = "112 Integrated Emergency Response Service"

    return severity, responder

def extract_casualty_count(text_lower: str) -> int:
    """
    Extracts number of injured or affected individuals from natural language.
    Handles phrases like 'Two people fell down', 'rendu per', '4 persons', etc.
    """
    found_counts = []

    # 1. Look for explicit digit patterns like "2 people", "4 persons", "1 injured"
    digit_matches = re.findall(r'(\d+)\s*(?:people|persons|victims|injured|per|aalu|log)', text_lower)
    for m in digit_matches:
        try:
            found_counts.append(int(m))
        except ValueError:
            pass

    # 2. Look for phrases like "at least X"
    at_least_match = re.search(r'at least (\d+)', text_lower)
    if at_least_match:
        try:
            found_counts.append(int(at_least_match.group(1)))
        except ValueError:
            pass

    # 3. Look for word matches (sort by count descending so 'two' takes precedence over 'one')
    for word, count in sorted(CASUALTY_WORD_MAP.items(), key=lambda x: x[1], reverse=True):
        pattern = rf'\b{re.escape(word)}\s+(?:people|persons|victims|per|aalu|log|casualty)?\b'
        if re.search(pattern, text_lower):
            found_counts.append(count)

    if found_counts:
        return max(found_counts)

    return 1 # Default assumption: at least 1 person is affected


def resolve_landmark(text_lower: str) -> Dict[str, Any]:
    """
    Matches caller description against local landmarks database.
    Supports colloquial nicknames, Tamil, and English.
    """
    best_match = None
    best_alias = ""
    highest_score = 0

    for landmark in LANDMARKS_DB:
        # Check all aliases
        for alias in landmark.get("aliases", []):
            alias_lower = alias.lower()
            if alias_lower in text_lower:
                # Longer alias matches carry higher specificity
                score = len(alias_lower)
                if score > highest_score:
                    highest_score = score
                    best_match = landmark
                    best_alias = alias

    if best_match:
        return {
            "resolved": True,
            "id": best_match["id"],
            "name": best_match["name"],
            "lat": best_match["lat"],
            "lng": best_match["lng"],
            "description": best_match.get("description", ""),
            "matched_phrase": best_alias,
            "confidence": 0.95 if highest_score > 8 else 0.80
        }

    # Fallback if no specific landmark in DB matched
    return {
        "resolved": False,
        "id": "unknown_location",
        "name": "Location pending operator clarification",
        "lat": 13.0827, # Default to center of Chennai
        "lng": 80.2707,
        "description": "Caller mentioned no known registered landmark. Ask caller for nearest cross-street or building.",
        "matched_phrase": None,
        "confidence": 0.20
    }

def get_operator_next_questions(emergency_type: str) -> List[str]:
    """
    Returns curated, essential follow-up questions for the operator to ask.
    """
    questions = {
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
    }
    return questions.get(emergency_type, [
        "What is the exact street name or nearest building to your location?",
        "How many people need immediate medical attention?",
        "Is the patient responsive right now?"
    ])

def extract_incident_card(raw_transcript: str) -> Dict[str, Any]:
    """
    Main extraction pipeline: converts raw transcript text into a structured
    incident card with emergency classification, landmark resolution,
    responder dispatch, operator questions, and verified first aid protocol.
    """
    text_clean = raw_transcript.strip()
    text_lower = text_clean.lower()

    # 1. Detect Emergency Type
    type_key, type_display, matched_kws = detect_emergency_type(text_lower)

    # 2. Extract Casualty Count
    casualties = extract_casualty_count(text_lower)

    # 3. Determine Severity and Dispatch Unit
    severity, responder = calculate_severity_and_responder(type_key, text_lower, casualties)

    # 4. Resolve Landmark and GPS coordinates
    landmark_info = resolve_landmark(text_lower)

    # 5. Get Operator Prompts
    prompts = get_operator_next_questions(type_key)

    # 6. Retrieve Vetted First Aid Protocol
    first_aid = FIRST_AID_DB.get(type_key, {
        "title": "General Emergency First Response",
        "disclaimer": "VERIFY AGAINST LOCAL PROTOCOLS. Keep patient safe, calm, and monitor breathing until responders arrive.",
        "steps": [
            "Keep the patient calm and comfortable.",
            "Do not move the patient unless there is immediate danger.",
            "Monitor breathing and responsiveness continuously."
        ],
        "voice_prompt": "Stay on the line. Help is on the way. Keep the patient comfortable and do not move them."
    })

    # 7. Generate concise operator summary
    loc_name = landmark_info["name"] if landmark_info["resolved"] else "Location Unconfirmed"
    summary = f"[{severity}] {type_display} reported near {loc_name}. Estimated {casualties} casualty/affected. Dispatched: {responder}."

    return {
        "emergency_type": type_key,
        "emergency_display": type_display,
        "severity": severity,
        "suggested_responder": responder,
        "casualty_count": casualties,
        "location": landmark_info,
        "operator_questions": prompts,
        "first_aid": first_aid,
        "matched_keywords": matched_kws,
        "summary": summary,
        "source": "rule_based_fallback"
    }
