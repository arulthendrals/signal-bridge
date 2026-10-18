"""
SignalBridge - Stage 1 Verification Script
-------------------------------------------
Tests the rule-based extractor and landmark resolution directly
against all sample emergency calls.
"""

import json
from app.extractor import extract_incident_card, load_json_file

def run_tests():
    print("=" * 65)
    print("      SIGNALBRIDGE - STAGE 1 AUTOMATED VERIFICATION")
    print("=" * 65)

    # 1. Test Sample Calls
    calls = load_json_file("sample_calls.json")
    print(f"\n[+] Loaded {len(calls)} sample emergency calls from sample_calls.json")

    for i, call in enumerate(calls, 1):
        print("\n" + "-" * 60)
        print(f"TESTING CALL {i}: {call['title']}")
        print(f"Language : {call['language']}")
        print(f"Caller   : {call['caller_name']} ({call['caller_phone']})")
        print(f"Text     : \"{call['transcript'][:80]}...\"")

        result = extract_incident_card(call['transcript'])

        print("\n  -> EXTRACTED INCIDENT CARD:")
        print(f"     Type       : {result['emergency_display']}")
        print(f"     Severity   : {result['severity']}")
        print(f"     Responder  : {result['suggested_responder']}")
        print(f"     Casualties : {result['casualty_count']}")
        print(f"     Landmark   : {result['location']['name']}")
        print(f"     GPS Lat/Lng: ({result['location']['lat']}, {result['location']['lng']})")
        print(f"     Matched    : \"{result['location']['matched_phrase']}\"")
        print(f"     First Aid  : {result['first_aid']['title']}")
        print(f"     Voice TTS  : \"{result['first_aid']['voice_prompt']}\"")
        print(f"     Operator Qs: {result['operator_questions'][0]}")

        # Assertions
        assert result['severity'] in ["CRITICAL", "HIGH"], "Severity triage failed"
        assert result['location']['resolved'] is True, "Landmark resolution failed"
        assert len(result['operator_questions']) > 0, "Missing operator questions"
        assert len(result['first_aid']['steps']) > 0, "Missing first aid steps"

    # 2. Test colloquial landmark challenge: "near the temple after the flyover"
    print("\n" + "-" * 60)
    print("TESTING COLLOQUIAL LANDMARK CHALLENGE:")
    challenge_text = "Someone collapsed near the temple after the flyover, please send help quickly!"
    print(f"Input: \"{challenge_text}\"")
    challenge_result = extract_incident_card(challenge_text)
    print(f"Matched Landmark: {challenge_result['location']['name']}")
    print(f"Coordinates     : {challenge_result['location']['lat']}, {challenge_result['location']['lng']}")
    assert "Kapaleeshwarar" in challenge_result['location']['name'] or challenge_result['location']['resolved']

    print("\n" + "=" * 65)
    print("  ALL STAGE 1 TESTS PASSED SUCCESSFULLY! BACKEND & TRIAGE READY")
    print("=" * 65)

if __name__ == "__main__":
    run_tests()
