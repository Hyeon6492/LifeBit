from pydantic import BaseModel
from datetime import date
from typing import Optional, Union

# 🏋️ 운동 기록 - 요청용 (입력 데이터)
class ExerciseInput(BaseModel):
    user_id: int
    notes: str
    duration_minutes: Optional[int] = 30
    calories_burned: Optional[int] = 200
    exercise_date: Optional[date] = date.today()

# 🍽️ 식단 기록 - 요청용 (입력 데이터)
class MealInput(BaseModel):
    user_id: int
    food_item_id: Optional[int] = None
    quantity: float
    log_date: Optional[date] = date.today()
    meal_time: Optional[str] = None
    food_name: Optional[str] = None
    nutrition: Optional[dict] = None

# (선택) 응답용 모델이 필요하면 아래 추가 가능
class ExerciseOutput(BaseModel):
    user_id: int
    notes: str
    duration_minutes: int
    calories_burned: int
    exercise_date: date

    class Config:
        from_attributes = True

class MealOutput(BaseModel):
    user_id: int
    food_item_id: Optional[int]
    quantity: float
    log_date: date

    class Config:
        from_attributes = True

        # 🔽 오늘 운동 기록 조회용 (프론트엔드 Note.tsx 사용 타입과 일치)
class DailyExerciseRecord(BaseModel):
    exercise_session_id: int
    name: Optional[str] = "기타 운동"  # ← fallback
    weight: str
    sets: int
    reps: int
    time: str  # 예: "2분" 또는 "30초"

class ExerciseRecord(BaseModel):
    user_id: int
    name: str
    exercise_catalog_id: Optional[int] = None  # 운동 카탈로그 ID 추가
    weight: Optional[float]
    sets: Optional[int]
    reps: Optional[int]
    duration_minutes: Optional[int]
    calories_burned: Optional[float]
    exercise_date: Optional[date] = date.today()  # ✅ 이걸로 수정


# ✅ 챗봇에서 운동 기록 저장용 (name, weight 등 포함)
class ExerciseChatInput(BaseModel):
    user_id: int
    name: str                # 운동 이름 (예: 플랭크)
    weight: str              # 보통은 체중 기준 (예: "50kg")
    sets: int
    reps: int
    time: str                # 예: "2분", "30초"
    calories_burned: Optional[float] = None
    exercise_date: Optional[date] = date.today()

# (선택) 저장 후 반환할 때 쓸 수 있는 출력 스키마
class ExerciseChatOutput(ExerciseChatInput):
    class Config:
        from_attributes = True

class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[list] = []
    record_type: Optional[str] = None  # "exercise" or "diet" or None
    chat_step: Optional[str] = None
    current_data: Optional[Union[dict, list]] = None  # dict 또는 list 모두 허용
    meal_time_mapping: Optional[dict] = None  # 식단 시간 매핑
    user_id: Optional[int] = None  # 사용자 ID 추가 

    class Config:
        # 추가 필드 허용 (meal_time_mapping의 동적 필드들)
        extra = "allow"
