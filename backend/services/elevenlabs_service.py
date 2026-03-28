import os
import base64
import requests

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")

BASE_URL = "https://api.elevenlabs.io/v1"
HEADERS = {
    "xi-api-key": ELEVENLABS_API_KEY,
    "Content-Type": "application/json",
}


def create_interview_agent(interview_plan: dict) -> str:
    """Create an ElevenLabs agent using Gemini's interview plan. Returns agent_id."""

    # Build the question list for the system prompt
    questions_text = ""
    for i, q in enumerate(interview_plan.get("questions", []), 1):
        questions_text += f"""
Question {i} ({q.get('category', 'general')}):
Ask: "{q.get('question', '')}"
Why this matters: {q.get('why', '')}
If they give a weak/vague answer, follow up with: "{q.get('follow_up_if_weak', 'Can you elaborate?')}"
"""

    red_flags = "\n".join(f"- {rf}" for rf in interview_plan.get("red_flags_to_watch", []))
    areas = ", ".join(interview_plan.get("key_areas_to_probe", []))

    system_prompt = f"""You are a sharp, experienced senior technical interviewer at a top tech company. You are conducting a rigorous mock interview to genuinely test this candidate.

CANDIDATE PROFILE:
{interview_plan.get('candidate_summary', 'A candidate')}
Target Role: {interview_plan.get('target_role', 'Software Developer')}
Experience Level: {interview_plan.get('experience_level', 'mid')}
Key Areas to Probe: {areas}

YOUR INTERVIEW PLAN (follow this order):
{questions_text}

RED FLAGS TO WATCH FOR:
{red_flags}

CRITICAL INTERVIEWER BEHAVIOR:
- You are NOT a cheerleader. Do NOT over-praise or say things like "That's great!", "Wonderful!", "Excellent answer!" after every response
- Keep acknowledgments MINIMAL — just "Okay", "Got it", "I see", "Alright" and move to the next question
- ONLY give genuine praise when an answer is truly exceptional with specific technical depth
- If an answer is vague, shallow, or just buzzwords — PUSH BACK. Ask follow-up: "Can you be more specific?", "What exactly did you do?", "Walk me through the actual implementation"
- If they say they "used" a technology, ask HOW: "You mentioned React — what state management did you use? Why that choice?"
- If they claim a project achievement, probe the details: "You said it handles 10k users — how did you test that? What was the architecture?"
- Challenge weak answers: "That sounds like a textbook answer. Can you give me a real example from your own experience?"
- Ask at least 1-2 follow-up questions per answer to dig deeper before moving to the next planned question
- Be professional and respectful, but direct and no-nonsense
- Your job is to find out what they ACTUALLY know vs what they just put on their resume

FLOW:
- Follow the question plan IN ORDER
- Ask ONE question at a time
- After their answer, probe deeper with 1-2 follow-ups, then move to the next question
- After all questions, thank them briefly and say the interview is complete
- Do NOT number your questions
- Do NOT reveal the interview plan"""

    first_message = interview_plan.get(
        "first_message",
        "Hi there! Welcome to your mock interview. I've reviewed your resume and I'm excited to learn more about you. Let's get started!"
    )

    body = {
        "name": "NEXUS Interview Agent",
        "conversation_config": {
            "agent": {
                "prompt": {
                    "prompt": system_prompt
                },
                "first_message": first_message,
                "language": "en",
            },
            "tts": {
                "voice_id": ELEVENLABS_VOICE_ID
            },
        },
    }

    try:
        resp = requests.post(f"{BASE_URL}/convai/agents/create", headers=HEADERS, json=body, timeout=20)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("agent_id", "")
        else:
            print(f"ElevenLabs create agent error: {resp.status_code} - {resp.text[:300]}")
            return ""
    except Exception as e:
        print(f"ElevenLabs create agent error: {e}")
        return ""


def get_signed_url(agent_id: str) -> str:
    """Get a signed URL for starting a conversation with the agent."""
    try:
        resp = requests.get(
            f"{BASE_URL}/convai/conversation/get-signed-url?agent_id={agent_id}",
            headers=HEADERS,
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            return data.get("signed_url", "")
        else:
            print(f"ElevenLabs signed URL error: {resp.status_code} - {resp.text[:300]}")
            return ""
    except Exception as e:
        print(f"ElevenLabs signed URL error: {e}")
        return ""


def get_conversation_transcript(conversation_id: str) -> list[dict]:
    """Fetch the transcript of a completed conversation."""
    try:
        resp = requests.get(
            f"{BASE_URL}/convai/conversations/{conversation_id}",
            headers=HEADERS,
            timeout=15,
        )
        if resp.status_code == 200:
            data = resp.json()
            return data.get("transcript", [])
        else:
            print(f"ElevenLabs transcript error: {resp.status_code} - {resp.text[:300]}")
            return []
    except Exception as e:
        print(f"ElevenLabs transcript error: {e}")
        return []


def delete_agent(agent_id: str):
    """Clean up agent after interview."""
    try:
        requests.delete(f"{BASE_URL}/convai/agents/{agent_id}", headers=HEADERS, timeout=10)
    except:
        pass
