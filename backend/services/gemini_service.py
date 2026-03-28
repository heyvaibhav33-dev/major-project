import os
import json
import google.generativeai as genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
genai.configure(api_key=GEMINI_API_KEY)

model = genai.GenerativeModel("gemini-2.5-flash")


def generate_interview_plan(resume_text: str) -> dict:
    """Analyze the resume and create a tailored interview plan with specific questions."""

    prompt = f"""You are a senior technical recruiter. Analyze this resume and create a personalized interview plan.

RESUME:
{resume_text[:3000]}

Create a comprehensive interview plan. Respond with ONLY valid JSON (no markdown, no code blocks):
{{
  "candidate_summary": "Brief 2-line summary of who this candidate is",
  "target_role": "What role they seem to be targeting",
  "experience_level": "fresher/junior/mid/senior",
  "key_areas_to_probe": ["area1", "area2", "area3"],
  "questions": [
    {{
      "category": "ice-breaker/technical/behavioral/project-deep-dive/situational",
      "question": "The specific question to ask",
      "why": "Why this question matters for this candidate",
      "follow_up_if_weak": "What to ask if they give a vague answer"
    }}
  ],
  "red_flags_to_watch": ["red flag 1", "red flag 2"],
  "first_message": "A warm, personalized opening message that references something specific from their resume"
}}

Rules:
- Generate exactly 8 questions
- Questions MUST be specific to THIS candidate's resume — reference their actual projects, skills, companies, tech stack BY NAME
- Mix: 1 ice-breaker, 4 technical (about their specific tech stack and projects), 1 behavioral, 1 project deep-dive, 1 situational
- Technical questions should test REAL understanding, not surface-level: ask about architecture choices, trade-offs, debugging, scaling, edge cases
- For freshers: ask them to explain HOW they built their projects, not just what. Ask about specific technical decisions, challenges, and what they'd do differently
- For experienced: focus on system design trade-offs, architecture decisions, production incidents, mentoring
- Each question should test something DIFFERENT — don't ask generic questions like "tell me about yourself" or "what are your strengths"
- The follow_up_if_weak should be a tough but fair probe: "Can you walk me through the actual code?", "What specific error did you encounter?", "How would you handle X edge case?"
- Questions should feel like they come from someone who has actually READ the resume deeply, not generic interview templates
- The first_message should be brief and professional, not overly enthusiastic"""

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()

        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

        plan = json.loads(text)
        return plan
    except Exception as e:
        print(f"Interview plan generation error: {e}")
        # Fallback plan
        return {
            "candidate_summary": "Candidate based on uploaded resume",
            "target_role": "Software Developer",
            "experience_level": "mid",
            "key_areas_to_probe": ["technical skills", "projects", "problem solving"],
            "questions": [
                {"category": "ice-breaker", "question": "Tell me about yourself and your journey so far.", "why": "Assess communication", "follow_up_if_weak": "What specifically excites you about your field?"},
                {"category": "technical", "question": "Walk me through the architecture of your most complex project.", "why": "Technical depth", "follow_up_if_weak": "What technologies did you use and why?"},
                {"category": "technical", "question": "What's a technical challenge you solved recently?", "why": "Problem solving", "follow_up_if_weak": "How did you debug it?"},
                {"category": "behavioral", "question": "Tell me about a time you disagreed with a teammate.", "why": "Teamwork", "follow_up_if_weak": "How was it resolved?"},
                {"category": "technical", "question": "How do you ensure code quality in your projects?", "why": "Best practices", "follow_up_if_weak": "Do you write tests?"},
                {"category": "project-deep-dive", "question": "Pick your favorite project and explain the hardest part.", "why": "Depth of understanding", "follow_up_if_weak": "What would you do differently?"},
                {"category": "behavioral", "question": "How do you handle tight deadlines?", "why": "Pressure management", "follow_up_if_weak": "Give a specific example."},
                {"category": "situational", "question": "If you found a critical bug in production on a Friday evening, what would you do?", "why": "Decision making", "follow_up_if_weak": "Who would you involve?"},
            ],
            "red_flags_to_watch": ["vague answers", "no specific examples"],
            "first_message": "Hi! I've reviewed your resume and I'm excited to chat. Let's start — tell me about yourself and your journey so far."
        }


def analyze_interview_stream(resume_text: str, transcript: str, questions: list, answers: list):
    """Stream analysis token by token, then send structured data at the end."""

    # Phase 1: Quick score call (non-streamed)
    score_prompt = f"""Based on this interview transcript, give an overall score from 0-100.
Respond with ONLY a number, nothing else.

Transcript:
{transcript[:2000]}"""

    try:
        score_resp = model.generate_content(score_prompt)
        score_text = score_resp.text.strip()
        overall_score = int(''.join(c for c in score_text if c.isdigit())[:3])
        overall_score = min(100, max(0, overall_score))
    except:
        overall_score = 50

    yield json.dumps({"type": "score", "data": {"overall_score": overall_score}})

    # Phase 2: Stream detailed analysis token by token
    analysis_prompt = f"""You are an expert interview coach. Analyze this mock interview and give detailed feedback.

Resume:
{resume_text[:1500]}

Interview Transcript:
{transcript}

Write your analysis in this EXACT format (use these exact headers):

## Strengths
- [List 3-4 specific strengths with brief explanations]

## Weaknesses
- [List 3-4 specific weaknesses with brief explanations]

## How to Improve
- [List 3-4 actionable improvement tips]

## Question Breakdown
For each question-answer pair:
**Q: [question text]**
Your answer: [what they said]
Score: [X/10]
Feedback: [specific feedback]

---

Be honest, constructive, and specific. Reference actual things the candidate said."""

    response = model.generate_content(analysis_prompt, stream=True)

    for chunk in response:
        if chunk.text:
            yield json.dumps({"type": "token", "data": {"text": chunk.text}})

    # Phase 3: Also generate structured JSON for the gauge/cards (non-streamed, in background)
    json_prompt = f"""Based on this interview, respond with ONLY valid JSON (no markdown):
Transcript: {transcript[:1500]}

{{"strengths":["s1","s2","s3"],"weaknesses":["w1","w2","w3"],"improvements":["i1","i2","i3"],"question_scores":[{{"question":"q","answer":"a","score":7,"feedback":"f"}}]}}"""

    try:
        json_resp = model.generate_content(json_prompt)
        jtext = json_resp.text.strip()
        if jtext.startswith("```"):
            jtext = jtext.split("\n", 1)[1]
            if jtext.endswith("```"):
                jtext = jtext[:-3]
            jtext = jtext.strip()
        structured = json.loads(jtext)
        yield json.dumps({"type": "structured", "data": structured})
    except:
        pass

    yield json.dumps({"type": "done"})
