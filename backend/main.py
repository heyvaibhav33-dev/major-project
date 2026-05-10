import json
import os
import time
import traceback
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from services.resume_parser import parse_pdf
from services.gemini_service import analyze_interview_stream, generate_interview_plan
from services.tavus_service import (
    create_conversation,
    get_conversation,
    end_conversation,
    extract_transcript,
)

app = FastAPI(title="NEXUS Interview API")

# CORS: comma-separated origins via env, falls back to "*" for local dev.
_cors_env = os.getenv("CORS_ORIGINS", "*").strip()
if _cors_env == "*" or not _cors_env:
    _origins = ["*"]
    _allow_credentials = False
else:
    _origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
    _allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Per-session: resume_text + interview_plan, keyed by conversation_id
sessions: dict[str, dict] = {}


class StartInterviewRequest(BaseModel):
    resume_text: str


class AnalyzeRequest(BaseModel):
    conversation_id: str


class EndConversationRequest(BaseModel):
    conversation_id: str


@app.get("/")
def health():
    return {"status": "ok", "service": "NEXUS Interview API"}


@app.post("/api/upload-resume")
async def upload_resume(file: UploadFile = File(...)):
    content = await file.read()
    text = parse_pdf(content)
    return {"text": text, "name": file.filename}


@app.post("/api/start-interview")
async def start_interview(req: StartInterviewRequest):
    try:
        # Step 1: Build the interview plan from the resume
        print("Generating interview plan...")
        interview_plan = generate_interview_plan(req.resume_text)
        print(
            f"Plan ready: {interview_plan.get('target_role')} | "
            f"{len(interview_plan.get('questions', []))} questions"
        )

        # Step 2: Spin up the live video interview session
        conv = create_conversation(interview_plan)
        if not conv or not conv.get("conversation_url"):
            return {"error": "Failed to create interview session. Please try again."}

        conversation_id = conv["conversation_id"]
        sessions[conversation_id] = {
            "resume_text": req.resume_text,
            "interview_plan": interview_plan,
        }

        return {
            "conversation_id": conversation_id,
            "conversation_url": conv["conversation_url"],
            "plan_summary": {
                "target_role": interview_plan.get("target_role", ""),
                "experience_level": interview_plan.get("experience_level", ""),
                "candidate_summary": interview_plan.get("candidate_summary", ""),
                "question_count": len(interview_plan.get("questions", [])),
            },
        }
    except Exception as e:
        print(f"ERROR: {traceback.format_exc()}")
        return {"error": str(e)}


@app.post("/api/end-interview")
async def end_interview(req: EndConversationRequest):
    """Cleanly terminate the interview session so the avatar leaves the room immediately."""
    ok = end_conversation(req.conversation_id)
    return {"ok": ok}


@app.post("/api/analyze")
async def analyze_endpoint(req: AnalyzeRequest):
    def stream():
        try:
            yield f"data: {json.dumps({'type': 'status', 'data': {'message': 'Ending interview session...'}})}\n\n"
            end_conversation(req.conversation_id)

            yield f"data: {json.dumps({'type': 'status', 'data': {'message': 'Fetching transcript...'}})}\n\n"

            # Allow the session a few seconds after end before the transcript is finalized
            transcript_str = ""
            questions: list[str] = []
            answers: list[str] = []
            for attempt in range(8):
                conv = get_conversation(req.conversation_id, verbose=True)
                if conv:
                    transcript_str, questions, answers = extract_transcript(conv)
                    if transcript_str.strip():
                        break
                yield f"data: {json.dumps({'type': 'status', 'data': {'message': f'Waiting for transcript... (attempt {attempt + 1}/8)'}})}\n\n"
                time.sleep(3)

            if not transcript_str.strip():
                yield f"data: {json.dumps({'type': 'error', 'message': 'No transcript available. The conversation may have been too short.'})}\n\n"
                return

            resume_text = sessions.get(req.conversation_id, {}).get("resume_text", "")

            yield f"data: {json.dumps({'type': 'status', 'data': {'message': 'Analyzing your interview...'}})}\n\n"
            yield f"data: {json.dumps({'type': 'transcript', 'data': {'transcript': transcript_str}})}\n\n"

            for event in analyze_interview_stream(resume_text, transcript_str, questions, answers):
                yield f"data: {event}\n\n"

            sessions.pop(req.conversation_id, None)

        except Exception as e:
            print(f"ERROR in analyze: {traceback.format_exc()}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8002"))
    uvicorn.run(app, host="0.0.0.0", port=port)
