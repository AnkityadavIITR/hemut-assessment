# Hemut - QA Dashboard Application

A full-stack Q&A dashboard application with user authentication, real-time question/answer management, and AI-powered answer suggestions using RAG (Retrieval-Augmented Generation).

## Tech Stack

### Backend

- **FastAPI** - Modern Python web framework
- **SQLite** - Lightweight database with aiosqlite for async operations
- **JWT Authentication** - Secure token-based authentication with passlib/bcrypt
- **LangChain + OpenAI** - RAG service for AI-powered answer suggestions
- **WebSockets** - Real-time communication

### Frontend

- **Next.js 16** - React framework with App Router
- **React 19** - Latest React version
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Utility-first styling

## Project Structure

```
hemut/
     backend/           # FastAPI backend
        main.py       # Main application entry point
        auth.py       # Authentication & JWT handling
        database.py   # Database models and operations
        models.py     # Pydantic models
        rag_service.py # RAG service for AI suggestions
        requirements.txt
    frontend/         # Next.js frontend
         app/         # Next.js App Router pages
        lib/         # Utility functions
        package.json
     readme.md
```

## Setup Instructions

### Backend Setup

1. **Navigate to backend directory**

   ```bash
   cd backend
   ```

2. **Create a virtual environment**

   ```bash
   python -m venv venv
   ```

3. **Activate the virtual environment**

   On macOS/Linux:

   ```bash
   source venv/bin/activate
   ```

4. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

5. **Set up environment variables**

   Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and update the following:

   ```env
   # Security - Change these in production!
   SECRET_KEY=your-secret-key
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30

   # Frontend URL
   FRONTEND_URL=http://localhost:3000

   # OpenAI API Key (optional - for AI-powered suggestions)
   OPENAI_API_KEY=your-openai-api-key-here
   ```

6. **Run the backend server**

   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

   The backend will be available at `http://localhost:8000`

   API documentation will be available at `http://localhost:8000/docs`

### Frontend Setup

1. **Navigate to frontend directory**

   ```bash
   cd frontend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run the development server**

   ```bash
   npm run dev
   ```

   The frontend will be available at `http://localhost:3000`

### Default Admin Credentials

**Important:** Change these credentials after your first login!

## Features

### User Features

- User registration and login
- Submit questions with categories
- View question status (Pending, Answered, Escalated)
- Real-time updates via WebSockets

### Admin Features

- View all questions in dashboard
- Answer questions
- Update question status
- AI-powered answer suggestions (when OpenAI API key is configured)
- Category-based filtering

### Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Protected API endpoints
- Role-based access control (Admin/User)

## API Endpoints

### Authentication

- `POST /api/register` - Register new user
- `POST /api/login` - Login and get JWT token

### Questions

- `GET /api/questions` - Get all questions (Admin only)
- `POST /api/questions` - Create new question
- `PATCH /api/questions/{id}/status` - Update question status (Admin only)

### Answers

- `GET /api/questions/{id}/answers` - Get answers for a question
- `POST /api/questions/{id}/answers` - Add answer (Admin only)

### RAG Service

- `POST /api/rag/suggest` - Get AI-suggested answer (Admin only)

### Running in Development Mode

1. Start the backend (in one terminal):

   ```bash
   cd backend
   source venv/bin/activate  # On macOS/Linux
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

2. Start the frontend (in another terminal):
   ```bash
   cd frontend
   npm run dev
   ```
