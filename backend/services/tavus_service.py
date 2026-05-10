"""Tavus CVI integration — creates real-time video interview conversations."""
from __future__ import annotations
import os
import json
import requests

TAVUS_API_KEY = os.getenv("TAVUS_API_KEY", "")
TAVUS_REPLICA_ID = os.getenv("TAVUS_REPLICA_ID", "r5f0577fc829")
TAVUS_PERSONA_ID = os.getenv("TAVUS_PERSONA_ID", "pdac61133ac5")

BASE = "https://tavusapi.com/v2"


def _headers() -> dict:
    return {"x-api-key": TAVUS_API_KEY, "Content-Type": "application/json"}


def _build_context(plan: dict) -> str:
    """Render the Gemini-generated interview plan into a Tavus conversational_context string."""
    role = plan.get("target_role", "Software Engineer")
    level = plan.get("experience_level", "mid")
    summary = plan.get("candidate_summary", "")
    interviewer = plan.get("interviewer_role", "Senior Engineer")
    areas = ", ".join(plan.get("key_areas_to_probe", []) or [])
    questions = plan.get("questions", []) or []

    q_lines = []
    for i, q in enumerate(questions, 1):
        text = q.get("question", "").strip()
        category = q.get("category", "")
        followup = q.get("follow_up_if_weak", "")
        q_lines.append(
            f"{i}. [{category}] {text}"
            + (f"\n   - Follow-up if weak: {followup}" if followup else "")
        )

    questions_block = "\n".join(q_lines) if q_lines else "(use your judgment)"

    return (
        f"You are conducting an interview for the role of {role} (level: {level}).\n"
        f"You are playing the part of: {interviewer}.\n\n"
        f"CANDIDATE BRIEF: {summary}\n"
        f"FOCUS AREAS: {areas}\n\n"
        f"INTERVIEW QUESTIONS (ask in this order, one at a time, wait for answer, "
        f"probe for specifics before moving on):\n{questions_block}\n\n"
        f"RULES:\n"
        f"- Ask ONE question at a time and wait for the candidate's full answer.\n"
        f"- Push for concrete examples, names, numbers — never let them stay vague.\n"
        f"- Keep your turns concise. This is a fast-paced screening, not a lecture.\n"
        f"- After all questions are covered, thank the candidate and end the call.\n"
    )


def _build_greeting(plan: dict) -> str:
    role = plan.get("target_role", "Software Engineer")
    fm = plan.get("first_message", "").strip()
    if fm:
        return fm[:300]
    return (
        f"Hi, thanks for joining. I've reviewed your resume — let's get started "
        f"with your {role} screening interview. Whenever you're ready, tell me "
        f"a bit about yourself."
    )


def create_conversation(plan: dict) -> dict | None:
    """Create a Tavus conversation. Returns dict with conversation_id + conversation_url, or None on error."""
    body = {
        "replica_id": TAVUS_REPLICA_ID,
        "persona_id": TAVUS_PERSONA_ID,
        "conversation_name": f"NEXUS — {plan.get('target_role', 'Interview')}",
        "conversational_context": _build_context(plan),
        "custom_greeting": _build_greeting(plan),
        "properties": {
            "max_call_duration": 1800,
            "participant_left_timeout": 10,
            "participant_absent_timeout": 60,
            "enable_closed_captions": True,
            "language": "english",
        },
    }
    try:
        r = requests.post(f"{BASE}/conversations", headers=_headers(), json=body, timeout=30)
        if r.status_code >= 300:
            print(f"Tavus create_conversation FAILED [{r.status_code}]: {r.text}")
            return None
        return r.json()
    except Exception as e:
        print(f"Tavus create_conversation error: {e}")
        return None


def get_conversation(conversation_id: str, verbose: bool = True) -> dict | None:
    """Fetch the conversation; with verbose=True it includes the events array (and the transcript)."""
    try:
        r = requests.get(
            f"{BASE}/conversations/{conversation_id}",
            headers=_headers(),
            params={"verbose": str(verbose).lower()},
            timeout=20,
        )
        if r.status_code >= 300:
            print(f"Tavus get_conversation FAILED [{r.status_code}]: {r.text}")
            return None
        return r.json()
    except Exception as e:
        print(f"Tavus get_conversation error: {e}")
        return None


def end_conversation(conversation_id: str) -> bool:
    """Force-terminate a conversation. Idempotent."""
    try:
        r = requests.post(
            f"{BASE}/conversations/{conversation_id}/end",
            headers=_headers(),
            timeout=15,
        )
        return r.status_code < 300
    except Exception as e:
        print(f"Tavus end_conversation error: {e}")
        return False


def extract_transcript(conv: dict) -> tuple[str, list[str], list[str]]:
    """Pull the transcript out of a verbose conversation payload.

    Returns (transcript_string, questions, answers).
    """
    events = conv.get("events") or []
    transcript_messages: list[dict] = []

    # Tavus exposes a transcript event whose properties.transcript is the canonical list.
    # Prefer the latest one if multiple (e.g. mid-call snapshots).
    for e in reversed(events):
        props = e.get("properties") or {}
        if isinstance(props.get("transcript"), list) and props["transcript"]:
            transcript_messages = props["transcript"]
            break

    # Fallback: stitch from individual utterance events if no consolidated transcript
    if not transcript_messages:
        for e in events:
            etype = e.get("event_type", "")
            if "utterance" in etype.lower():
                p = e.get("properties") or {}
                role = p.get("role") or p.get("speaker") or ""
                content = p.get("speech") or p.get("text") or p.get("content") or ""
                if role and content:
                    transcript_messages.append({"role": role, "content": content})

    transcript_str = ""
    questions: list[str] = []
    answers: list[str] = []
    for m in transcript_messages:
        role = (m.get("role") or "").lower()
        content = (m.get("content") or "").strip()
        if not content:
            continue
        if role in ("assistant", "agent", "replica"):
            transcript_str += f"Interviewer: {content}\n"
            questions.append(content)
        elif role in ("user", "candidate", "human"):
            transcript_str += f"Candidate: {content}\n"
            answers.append(content)

    return transcript_str, questions, answers
