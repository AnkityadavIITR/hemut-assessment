import sqlite3
import aiosqlite
from datetime import datetime
from typing import Optional, List, Dict
from contextlib import asynccontextmanager

DATABASE_URL = "qa_dashboard.db"


async def init_db():
    """Initialize the database with required tables."""
    async with aiosqlite.connect(DATABASE_URL) as db:
        # Users table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                is_admin BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Questions table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS questions (
                question_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                username TEXT NOT NULL,
                message TEXT NOT NULL,
                status TEXT DEFAULT 'Pending',
                category TEXT DEFAULT 'General',
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                answered_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (user_id)
            )
        """)

        # Answers table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS answers (
                answer_id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_id INTEGER NOT NULL,
                user_id INTEGER,
                username TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (question_id) REFERENCES questions (question_id),
                FOREIGN KEY (user_id) REFERENCES users (user_id)
            )
        """)

        # Create default admin user if not exists
        await db.execute("""
            INSERT OR IGNORE INTO users (username, email, password, is_admin)
            VALUES (?, ?, ?, ?)
        """, ("admin", "admin@example.com",
              "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqVqB6F/Da", 1))  # password: admin123

        await db.commit()


@asynccontextmanager
async def get_db():
    """Async context manager for database connections."""
    db = await aiosqlite.connect(DATABASE_URL)
    db.row_factory = aiosqlite.Row
    try:
        yield db
    finally:
        await db.close()


class UserDB:
    """Database operations for users."""

    @staticmethod
    async def create_user(username: str, email: str, hashed_password: str) -> Optional[int]:
        """Create a new user."""
        async with get_db() as db:
            try:
                cursor = await db.execute(
                    "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
                    (username, email, hashed_password)
                )
                await db.commit()
                return cursor.lastrowid
            except sqlite3.IntegrityError:
                return None

    @staticmethod
    async def get_user_by_username(username: str) -> Optional[Dict]:
        """Get user by username."""
        async with get_db() as db:
            cursor = await db.execute(
                "SELECT * FROM users WHERE username = ?", (username,)
            )
            row = await cursor.fetchone()
            if row:
                return dict(row)
            return None

    @staticmethod
    async def get_user_by_email(email: str) -> Optional[Dict]:
        """Get user by email."""
        async with get_db() as db:
            cursor = await db.execute(
                "SELECT * FROM users WHERE email = ?", (email,)
            )
            row = await cursor.fetchone()
            if row:
                return dict(row)
            return None


class QuestionDB:
    """Database operations for questions."""

    @staticmethod
    async def create_question(user_id: Optional[int], username: str, message: str, category: str = "General") -> int:
        """Create a new question."""
        async with get_db() as db:
            cursor = await db.execute(
                "INSERT INTO questions (user_id, username, message, category) VALUES (?, ?, ?, ?)",
                (user_id, username, message, category)
            )
            await db.commit()
            return cursor.lastrowid

    @staticmethod
    async def get_all_questions() -> List[Dict]:
        """Get all questions with their answers."""
        async with get_db() as db:
            cursor = await db.execute("""
                SELECT q.*,
                       COUNT(a.answer_id) as answer_count
                FROM questions q
                LEFT JOIN answers a ON q.question_id = a.question_id
                GROUP BY q.question_id
                ORDER BY
                    CASE q.status
                        WHEN 'Escalated' THEN 0
                        ELSE 1
                    END,
                    q.timestamp DESC
            """)
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    @staticmethod
    async def get_question_by_id(question_id: int) -> Optional[Dict]:
        """Get a specific question."""
        async with get_db() as db:
            cursor = await db.execute(
                "SELECT * FROM questions WHERE question_id = ?", (question_id,)
            )
            row = await cursor.fetchone()
            if row:
                return dict(row)
            return None

    @staticmethod
    async def update_question_status(question_id: int, status: str) -> bool:
        """Update question status."""
        async with get_db() as db:
            answered_at = datetime.now().isoformat() if status == "Answered" else None
            await db.execute(
                "UPDATE questions SET status = ?, answered_at = ? WHERE question_id = ?",
                (status, answered_at, question_id)
            )
            await db.commit()
            return True

    @staticmethod
    async def get_questions_by_category(category: str) -> List[Dict]:
        """Get questions by category."""
        async with get_db() as db:
            cursor = await db.execute(
                "SELECT * FROM questions WHERE category = ? ORDER BY timestamp DESC",
                (category,)
            )
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]


class AnswerDB:
    """Database operations for answers."""

    @staticmethod
    async def create_answer(question_id: int, user_id: Optional[int], username: str, message: str) -> int:
        """Create a new answer."""
        async with get_db() as db:
            cursor = await db.execute(
                "INSERT INTO answers (question_id, user_id, username, message) VALUES (?, ?, ?, ?)",
                (question_id, user_id, username, message)
            )
            await db.commit()
            return cursor.lastrowid

    @staticmethod
    async def get_answers_by_question(question_id: int) -> List[Dict]:
        """Get all answers for a question."""
        async with get_db() as db:
            cursor = await db.execute(
                "SELECT * FROM answers WHERE question_id = ? ORDER BY timestamp ASC",
                (question_id,)
            )
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]
