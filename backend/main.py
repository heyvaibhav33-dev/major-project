import json
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
from services.elevenlabs_service import (
    create_interview_agent,
    get_signed_url,
    get_conversation_transcript,
    delete_agent,
)

app = FastAPI(title="NEXUS Interview API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store agent IDs and resume text per session
sessions: dict[str, dict] = {}


class StartInterviewRequest(BaseModel):
    resume_text: str


class AnalyzeRequest(BaseModel):
    agent_id: str
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
        # Step 1: Gemini analyzes resume and creates tailored interview plan
        print("Generating interview plan with Gemini...")
        interview_plan = generate_interview_plan(req.resume_text)
        print(f"Plan ready: {interview_plan.get('target_role')} | {len(interview_plan.get('questions', []))} questions")

        # Step 2: Create ElevenLabs agent with Gemini's plan
        agent_id = create_interview_agent(interview_plan)
        if not agent_id:
            return {"error": "Failed to create interview agent"}

        # Step 3: Get signed URL for conversation
        signed_url = get_signed_url(agent_id)
        if not signed_url:
            return {"error": "Failed to get signed URL"}

        # Store resume + plan for analysis later
        sessions[agent_id] = {
            "resume_text": req.resume_text,
            "interview_plan": interview_plan,
        }

        return {
            "agent_id": agent_id,
            "signed_url": signed_url,
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


@app.post("/api/analyze")
async def analyze_endpoint(req: AnalyzeRequest):
    def stream():
        try:
            yield f"data: {json.dumps({'type': 'status', 'data': {'message': 'Fetching transcript from ElevenLabs...'}})}\n\n"

            # Retry fetching transcript (ElevenLabs may need a few seconds)
            transcript_data = []
            for attempt in range(5):
                transcript_data = get_conversation_transcript(req.conversation_id)
                if transcript_data:
                    break
                yield f"data: {json.dumps({'type': 'status', 'data': {'message': f'Waiting for transcript... (attempt {attempt + 1}/5)'}})}\n\n"
                time.sleep(3)

            resume_text = sessions.get(req.agent_id, {}).get("resume_text", "")

            # Build transcript string
            transcript = ""
            questions = []
            answers = []
            for entry in transcript_data:
                role = entry.get("role", "")
                message = entry.get("message", "")
                if role == "agent":
                    transcript += f"Interviewer: {message}\n"
                    questions.append(message)
                elif role == "user":
                    transcript += f"Candidate: {message}\n"
                    answers.append(message)

            if not transcript:
                yield f"data: {json.dumps({'type': 'error', 'message': 'No transcript found. Try having a longer conversation.'})}\n\n"
                return

            yield f"data: {json.dumps({'type': 'status', 'data': {'message': 'Analyzing with Gemini AI...'}})}\n\n"

            # Stream analysis from Gemini token by token
            for event in analyze_interview_stream(resume_text, transcript, questions, answers):
                yield f"data: {event}\n\n"

            # Cleanup
            delete_agent(req.agent_id)
            if req.agent_id in sessions:
                del sessions[req.agent_id]

        except Exception as e:
            print(f"ERROR in analyze: {traceback.format_exc()}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
