import os
import json
import google.generativeai as genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
genai.configure(api_key=GEMINI_API_KEY)

model = genai.GenerativeModel("gemini-2.5-flash")


def generate_interview_plan(resume_text: str) -> dict:
    """Analyze the resume and create a tailored interview plan with specific questions."""

    prompt = f"""You are a senior technical interviewer at a top tech company. Analyze this resume and create a rigorous, personalized interview plan.

RESUME:
{resume_text[:3000]}

First, identify what domain/role this candidate is targeting based on their resume (e.g., frontend dev, backend dev, ML engineer, data scientist, full-stack, mobile dev, DevOps, etc.). Then assume the role of a senior interviewer FOR THAT SPECIFIC DOMAIN and generate questions accordingly.

Create a comprehensive interview plan. Respond with ONLY valid JSON (no markdown, no code blocks):
{{
  "candidate_summary": "Brief 2-line summary of who this candidate is",
  "target_role": "What role they seem to be targeting",
  "interviewer_role": "The senior role you are assuming (e.g., Senior ML Engineer, Staff Frontend Engineer, etc.)",
  "experience_level": "fresher/junior/mid/senior",
  "key_areas_to_probe": ["area1", "area2", "area3"],
  "questions": [
    {{
      "category": "conceptual/technical-deep-dive/project-specific/system-design/behavioral/coding-logic/situational",
      "question": "The specific question to ask",
      "expected_good_answer": "Brief notes on what a strong answer would cover",
      "why": "Why this question matters for this candidate",
      "follow_up_if_weak": "Specific technical follow-up if they give a vague answer"
    }}
  ],
  "red_flags_to_watch": ["red flag 1", "red flag 2"],
  "first_message": "Brief professional opening that shows you've read their resume"
}}

QUESTION GENERATION RULES:

1. CONCEPTUAL QUESTIONS (2-3): Ask specific CS/domain fundamentals based on their listed skills.
   Examples by domain:
   - Python dev: "What's the difference between a list and a tuple? When would you choose one over the other?"
   - React dev: "Explain the difference between useEffect and useLayoutEffect. When would you use each?"
   - ML engineer: "Explain overfitting. How would you detect it and what techniques prevent it?"
   - Java dev: "What's the difference between an abstract class and an interface in Java? Give a real scenario for each."
   - Node.js dev: "Explain the event loop. What happens when you have a CPU-intensive task?"
   - Database: "What's the difference between SQL and NoSQL? When would you pick MongoDB over PostgreSQL?"
   Pick concepts SPECIFIC to the technologies listed on THEIR resume.

2. PROJECT-SPECIFIC QUESTIONS (2-3): Drill into their actual projects.
   - "In your [specific project name], how did you handle [specific technical challenge related to that project]?"
   - "You used [specific technology] in [project] — why that choice over [alternative]?"
   - "Walk me through the architecture of [their project]. How does data flow from frontend to database?"

3. CODING LOGIC (1): Ask a verbal coding/logic question.
   - "How would you find duplicates in an array? What's the time complexity?"
   - "If you had to design the database schema for your [project], what tables/collections would you need?"
   - "How would you implement pagination in an API? What are the tradeoffs between offset vs cursor?"

4. SYSTEM DESIGN / SITUATIONAL (1):
   - "If your [project] suddenly had 100x more users, what would break first and how would you fix it?"
   - "How would you deploy your [project] to production? Walk me through the steps."

5. BEHAVIORAL (1):
   - Keep it specific to their experience, not generic "tell me about a time..."

Generate exactly 8 questions total following the mix above.
Questions must reference their ACTUAL skills, projects, and technologies by name.
The first_message should be brief and professional — NOT enthusiastic or cheerful."""

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
