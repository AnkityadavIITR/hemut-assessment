from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import List, Optional
import os
from dotenv import load_dotenv
import logging

from database import init_db, UserDB, QuestionDB, AnswerDB
from models import (
    UserCreate, UserLogin, Token, User,
    QuestionCreate, QuestionUpdate, Question,
    AnswerCreate, Answer,
    RAGRequest, RAGResponse
)
from auth import (
    verify_password, get_password_hash, create_access_token,
    get_current_user, get_current_admin_user
)
from rag_service import rag_service


load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"Client disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients."""
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to client: {e}")


manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database...")
    await init_db()
    logger.info("Database initialized successfully!")
    yield
    logger.info("Shutting down...")


app = FastAPI(
    title="Q&A Dashboard API",
    description="Real-time Q&A Dashboard with WebSocket support",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.post("/api/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate):
    """Register a new user."""
    existing_user = await UserDB.get_user_by_username(user_data.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    existing_email = await UserDB.get_user_by_email(user_data.email)
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    hashed_password = get_password_hash(user_data.password)
    user_id = await UserDB.create_user(user_data.username, user_data.email, hashed_password)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )

    user = await UserDB.get_user_by_username(user_data.username)

    access_token = create_access_token(
        data={
            "sub": user["username"],
            "user_id": user["user_id"],
            "is_admin": bool(user["is_admin"])
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "user_id": user["user_id"],
            "username": user["username"],
            "email": user["email"],
            "is_admin": bool(user["is_admin"])
        }
    }


@app.post("/api/login", response_model=Token)
async def login(credentials: UserLogin):
    """Authenticate user and return token."""
    user = await UserDB.get_user_by_username(credentials.username)

    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={
            "sub": user["username"],
            "user_id": user["user_id"],
            "is_admin": bool(user["is_admin"])
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "user_id": user["user_id"],
            "username": user["username"],
            "email": user["email"],
            "is_admin": bool(user["is_admin"])
        }
    }


@app.get("/api/me", response_model=dict)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information."""
    user = await UserDB.get_user_by_username(current_user["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "user_id": user["user_id"],
        "username": user["username"],
        "email": user["email"],
        "is_admin": bool(user["is_admin"])
    }



@app.post("/api/questions", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_question(
    question_data: QuestionCreate,
    current_user: Optional[dict] = Depends(get_current_user)
):
    """Submit a new question. Authentication optional for guests."""
    try:
        user_id = current_user.get("user_id") if current_user else None
        username = current_user.get("sub") if current_user else question_data.username

        question_id = await QuestionDB.create_question(
            user_id=user_id,
            username=username,
            message=question_data.message,
            category=question_data.category
        )

        question = await QuestionDB.get_question_by_id(question_id)

        await manager.broadcast({
            "type": "new_question",
            "data": question
        })

        return {
            "message": "Question submitted successfully",
            "question_id": question_id,
            "question": question
        }
    except Exception as e:
        logger.error(f"Error creating question: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create question"
        )


@app.get("/api/questions", response_model=List[Question])
async def get_questions(category: Optional[str] = None):
    """Get all questions, optionally filtered by category."""
    try:
        if category and category != "All":
            questions = await QuestionDB.get_questions_by_category(category)
        else:
            questions = await QuestionDB.get_all_questions()
        return questions
    except Exception as e:
        logger.error(f"Error fetching questions: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch questions"
        )


@app.patch("/api/questions/{question_id}", response_model=dict)
async def update_question_status(
    question_id: int,
    update_data: QuestionUpdate,
    current_user: dict = Depends(get_current_admin_user)
):
    """Update question status. Admin only."""
    question = await QuestionDB.get_question_by_id(question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    await QuestionDB.update_question_status(question_id, update_data.status)

    updated_question = await QuestionDB.get_question_by_id(question_id)

    await manager.broadcast({
        "type": "question_updated",
        "data": updated_question
    })

    return {
        "message": "Question status updated successfully",
        "question": updated_question
    }



@app.post("/api/answers", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_answer(
    answer_data: AnswerCreate,
    current_user: Optional[dict] = Depends(get_current_user)
):
    """Submit an answer to a question. Authentication optional for guests."""
    try:
        # Verify question exists
        question = await QuestionDB.get_question_by_id(answer_data.question_id)
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")

        user_id = current_user.get("user_id") if current_user else None
        username = current_user.get("sub") if current_user else answer_data.username

        answer_id = await AnswerDB.create_answer(
            question_id=answer_data.question_id,
            user_id=user_id,
            username=username,
            message=answer_data.message
        )

        answers = await AnswerDB.get_answers_by_question(answer_data.question_id)
        created_answer = next((a for a in answers if a["answer_id"] == answer_id), None)

        await manager.broadcast({
            "type": "new_answer",
            "data": created_answer
        })

        return {
            "message": "Answer submitted successfully",
            "answer_id": answer_id,
            "answer": created_answer
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating answer: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create answer"
        )


@app.get("/api/questions/{question_id}/answers", response_model=List[Answer])
async def get_answers(question_id: int):
    """Get all answers for a specific question."""
    try:
        # Verify question exists
        question = await QuestionDB.get_question_by_id(question_id)
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")

        answers = await AnswerDB.get_answers_by_question(question_id)
        return answers
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching answers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch answers"
        )


@app.post("/api/rag/suggest", response_model=RAGResponse)
async def get_answer_suggestion(request: RAGRequest):
    """Get AI-suggested answer for a question using RAG."""
    try:
        result = await rag_service.get_suggested_answer(request.question)
        print(result)
        return result
    except Exception as e:
        logger.error(f"Error getting RAG suggestion: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate suggestion"
        )


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates."""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            logger.info(f"Received from client: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)



@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "message": "Q&A Dashboard API",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    """Detailed health check."""
    return {
        "status": "healthy",
        "websocket_connections": len(manager.active_connections),
        "database": "connected"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=True
    )
