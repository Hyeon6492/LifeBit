from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import models, schemas
from database import engine, get_db
import openai, os
from dotenv import load_dotenv
import tempfile
from datetime import date

# Load .env
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")

app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB 테이블 생성
models.Base.metadata.create_all(bind=engine)

# 헬스 체크
@app.get("/")
def health_check():
    return {"status": "OK", "service": "LifeBit AI-API"}

# 음성 업로드 → Whisper + GPT + 기록 저장
@app.post("/api/py/voice")
async def process_voice(file: UploadFile = File(...), db: Session = Depends(get_db)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
        tmp.write(await file.read())
        temp_path = tmp.name

    with open(temp_path, "rb") as f:
        transcript = openai.Audio.transcribe("whisper-1", f)

    user_text = transcript["text"]

    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "운동 기록 또는 식단 기록을 도와주세요. 형식은 '운동', '식단' 중 하나로 구분됩니다."},
            {"role": "user", "content": user_text}
        ]
    )

    gpt_reply = response.choices[0].message["content"]

    # 💡 간단한 예시: GPT 응답 내에 "운동" / "식단" 키워드로 분기
    record_type = "exercise" if "운동" in gpt_reply else "diet"

    try:
        if record_type == "exercise":
            new_record = models.ExerciseSession(
                user_id=1,  # ⚠️ 임시: 로그인 시스템 붙이면 교체
                exercise_catalog_id=None,
                duration_minutes=30,
                calories_burned=200,
                notes=user_text,
                exercise_date=date.today()
            )
            db.add(new_record)

        elif record_type == "diet":
            new_record = models.MealLog(
                user_id=1,  # ⚠️ 임시
                food_item_id=None,
                quantity=1.0,
                log_date=date.today()
            )
            db.add(new_record)

        db.commit()

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB 저장 실패: {str(e)}")

    return {"user_input": user_text, "gpt_reply": gpt_reply}
