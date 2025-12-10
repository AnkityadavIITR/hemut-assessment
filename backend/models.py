from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)
    is_admin: Optional[bool] = Field(default=False)


class UserLogin(BaseModel):
    username: str
    password: str


class User(BaseModel):
    user_id: int
    username: str
    email: str
    is_admin: bool
    created_at: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict


class QuestionCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    username: str = Field(default="Guest")
    category: str = Field(default="General")


class QuestionUpdate(BaseModel):
    status: str = Field(..., pattern="^(Pending|Escalated|Answered)$")


class Question(BaseModel):
    question_id: int
    user_id: Optional[int]
    username: str
    message: str
    status: str
    category: str
    timestamp: str
    answered_at: Optional[str]
    answer_count: int = 0


class AnswerCreate(BaseModel):
    question_id: int
    message: str = Field(..., min_length=1, max_length=2000)
    username: str = Field(default="Guest")


class Answer(BaseModel):
    answer_id: int
    question_id: int
    user_id: Optional[int]
    username: str
    message: str
    timestamp: str


class WebhookPayload(BaseModel):
    event: str
    question_id: int
    question: str
    status: str
    answered_at: str
    timestamp: str


class RAGRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)


class RAGResponse(BaseModel):
    question: str
    suggested_answer: str
    confidence: float
    sources: List[str] = []
