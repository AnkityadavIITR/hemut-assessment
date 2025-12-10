const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface User {
  user_id: number;
  username: string;
  email: string;
  is_admin: boolean;
}

export interface Question {
  question_id: number;
  user_id?: number;
  username: string;
  message: string;
  status: "Pending" | "Escalated" | "Answered";
  category: string;
  timestamp: string;
  answered_at?: string;
  answer_count?: number;
}

export interface Answer {
  answer_id: number;
  question_id: number;
  user_id?: number;
  username: string;
  message: string;
  timestamp: string;
}

export interface RAGSuggestion {
  question: string;
  suggested_answer: string;
  confidence: number;
  sources: string[];
}

class APIClient {
  private getToken(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("token");
    }
    return null;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const token = this.getToken();
    const headers = new Headers(options.headers as HeadersInit);

    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ detail: "Request failed" }));
      throw new Error(error.detail || "Request failed");
    }

    return response.json();
  }

  async register(username: string, email: string, password: string) {
    const data = await this.request("/api/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
    if (data.access_token) {
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
    }
    return data;
  }

  async login(username: string, password: string) {
    const data = await this.request("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    if (data.access_token) {
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
    }
    return data;
  }

  async getCurrentUser(): Promise<User> {
    return this.request("/api/me");
  }

  logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  async getQuestions(category?: string): Promise<Question[]> {
    const params = category ? `?category=${encodeURIComponent(category)}` : "";
    return this.request(`/api/questions${params}`);
  }

  async createQuestion(
    message: string,
    username: string = "Guest",
    category: string = "General"
  ) {
    return this.request("/api/questions", {
      method: "POST",
      body: JSON.stringify({ message, username, category }),
    });
  }

  async updateQuestionStatus(questionId: number, status: string) {
    return this.request(`/api/questions/${questionId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  async getAnswers(questionId: number): Promise<Answer[]> {
    return this.request(`/api/questions/${questionId}/answers`);
  }

  async createAnswer(
    questionId: number,
    message: string,
    username: string = "Guest"
  ) {
    return this.request("/api/answers", {
      method: "POST",
      body: JSON.stringify({ question_id: questionId, message, username }),
    });
  }

  async getSuggestedAnswer(question: string): Promise<RAGSuggestion> {
    return this.request("/api/rag/suggest", {
      method: "POST",
      body: JSON.stringify({ question }),
    });
  }
}

export const api = new APIClient();
