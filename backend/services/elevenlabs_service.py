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

    system_prompt = f"""You are a professional, warm, and perceptive job interviewer conducting a mock interview.

CANDIDATE PROFILE:
{interview_plan.get('candidate_summary', 'A candidate')}
Target Role: {interview_plan.get('target_role', 'Software Developer')}
Experience Level: {interview_plan.get('experience_level', 'mid')}
Key Areas to Probe: {areas}

YOUR INTERVIEW PLAN (follow this order):
{questions_text}

RED FLAGS TO WATCH FOR:
{red_flags}

INSTRUCTIONS:
- Follow the question plan above IN ORDER
- Ask ONE question at a time
- After each answer, give a brief, natural acknowledgment (1 sentence) before moving to the next question
- If the candidate gives a vague or weak answer, use the follow-up prompt provided
- If they give a great answer, acknowledge it genuinely before moving on
- Be conversational and natural — don't sound scripted
- Adapt your tone to their experience level: encouraging for freshers, peer-to-peer for experienced
- After all 8 questions, thank them warmly and say the interview is complete
- Do NOT number your questions or say "Question 1", "Question 2" etc
- Do NOT reveal the interview plan or scoring criteria"""

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
