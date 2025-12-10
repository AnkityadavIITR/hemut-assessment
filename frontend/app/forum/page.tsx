"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, Question, Answer, RAGSuggestion } from "@/lib/api";
import { useWebSocket } from "@/lib/useWebSocket";

const CATEGORIES = ["General", "Technical", "Support", "Feedback", "Other"];

export default function ForumPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<{ [key: number]: Answer[] }>({});
  const [loading, setLoading] = useState(true);

  const [questionText, setQuestionText] = useState("");
  const [category, setCategory] = useState("General");
  const [guestName, setGuestName] = useState("");
  const [questionError, setQuestionError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [ragSuggestion, setRagSuggestion] = useState<RAGSuggestion | null>(
    null
  );
  const [loadingRag, setLoadingRag] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const [showAnswerForm, setShowAnswerForm] = useState<{
    [key: number]: boolean;
  }>({});
  const [answerTexts, setAnswerTexts] = useState<{ [key: number]: string }>({});
  const [answerGuestNames, setAnswerGuestNames] = useState<{
    [key: number]: string;
  }>({});

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse user data");
      }
    }
  }, []);

  const fetchQuestions = useCallback(async () => {
    try {
      const data = await api.getQuestions(
        selectedCategory !== "All" ? selectedCategory : undefined
      );
      setQuestions(data);
    } catch (error) {
      console.error("Failed to fetch questions:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  useWebSocket(
    useCallback((message) => {
      if (message.type === "new_question") {
        setQuestions((prev) => {
          const exists = prev.find(
            (q) => q.question_id === message.data.question_id
          );
          if (exists) return prev;
          return [message.data, ...prev];
        });
      } else if (message.type === "question_updated") {
        setQuestions((prev) =>
          prev.map((q) =>
            q.question_id === message.data.question_id ? message.data : q
          )
        );
      } else if (message.type === "new_answer") {
        const questionId = message.data.question_id;
        setAnswers((prev) => ({
          ...prev,
          [questionId]: [...(prev[questionId] || []), message.data],
        }));
        setQuestions((prev) =>
          prev.map((q) =>
            q.question_id === questionId
              ? { ...q, answer_count: (q.answer_count || 0) + 1 }
              : q
          )
        );
      }
    }, [])
  );

  const validateQuestionWithXHR = (text: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "data:application/json;charset=utf-8,", true);
      xhr.setRequestHeader("Content-Type", "application/json");

      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (!text || text.trim() === "") {
            resolve("Question cannot be empty");
          } else if (text.length < 10) {
            resolve("Question must be at least 10 characters");
          } else if (text.length > 1000) {
            resolve("Question must be less than 1000 characters");
          } else {
            resolve(null);
          }
        }
      };

      xhr.send(JSON.stringify({ text }));
    });
  };

  const handleSubmitQuestion = async (e: FormEvent) => {
    e.preventDefault();
    setQuestionError("");

    const error = await validateQuestionWithXHR(questionText);
    if (error) {
      setQuestionError(error);
      return;
    }

    if (!user && (!guestName || guestName.trim() === "")) {
      setQuestionError("Please enter your name");
      return;
    }

    setSubmitting(true);

    try {
      const username = user ? user.username : guestName;
      await api.createQuestion(questionText, username, category);

      setQuestionText("");
      setGuestName("");
      setRagSuggestion(null);

      await fetchQuestions();
    } catch (error: any) {
      setQuestionError(error.message || "Failed to submit question");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGetSuggestion = async () => {
    if (!questionText || questionText.trim() === "") {
      setQuestionError("Please enter a question first");
      return;
    }

    setLoadingRag(true);
    try {
      const suggestion = await api.getSuggestedAnswer(questionText);
      setRagSuggestion(suggestion);
    } catch (error) {
      console.error("Failed to get suggestion:", error);
    } finally {
      setLoadingRag(false);
    }
  };

  const loadAnswers = async (questionId: number) => {
    if (answers[questionId]) {
      return; // Already loaded
    }
    try {
      const data = await api.getAnswers(questionId);
      setAnswers((prev) => ({ ...prev, [questionId]: data }));
    } catch (error) {
      console.error("Failed to load answers:", error);
    }
  };

  const toggleAnswerForm = (questionId: number) => {
    setShowAnswerForm((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
    if (!answers[questionId]) {
      loadAnswers(questionId);
    }
  };

  const handleSubmitAnswer = async (questionId: number) => {
    const answerText = answerTexts[questionId];
    if (!answerText || answerText.trim() === "") {
      return;
    }

    if (
      !user &&
      (!answerGuestNames[questionId] ||
        answerGuestNames[questionId].trim() === "")
    ) {
      return;
    }

    try {
      const username = user ? user.username : answerGuestNames[questionId];
      await api.createAnswer(questionId, answerText, username);

      setAnswerTexts((prev) => ({ ...prev, [questionId]: "" }));
      setAnswerGuestNames((prev) => ({ ...prev, [questionId]: "" }));

      const data = await api.getAnswers(questionId);
      setAnswers((prev) => ({ ...prev, [questionId]: data }));
    } catch (error) {
      console.error("Failed to submit answer:", error);
    }
  };

  const handleUpdateStatus = async (questionId: number, status: string) => {
    if (!user || !user.is_admin) return;

    try {
      await api.updateQuestionStatus(questionId, status);
      await fetchQuestions();
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    router.push("/login");
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div>
      <nav className="navbar">
        <h1>Q&A Dashboard</h1>
        <div className="navbar-user">
          {user ? (
            <>
              <div className="user-info">
                <div className="user-avatar">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span>{user.username}</span>
                {user.is_admin && <span className="admin-badge">ADMIN</span>}
              </div>
              <button className="btn-logout" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => router.push("/login")}
                style={{
                  padding: "8px 20px",
                  background: "#667eea",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                Login
              </button>
              <button
                onClick={() => router.push("/register")}
                style={{
                  padding: "8px 20px",
                  background: "#764ba2",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                Register
              </button>
            </>
          )}
        </div>
      </nav>

      <div className="forum-container">
        <div className="question-form">
          <h2>Ask a Question</h2>
          <form onSubmit={handleSubmitQuestion}>
            <div className="form-row">
              {!user && (
                <div className="form-group">
                  <label htmlFor="guestName">Your Name</label>
                  <input
                    id="guestName"
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Enter your name"
                  />
                </div>
              )}
              <div className="form-group">
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="question">Your Question</label>
              <textarea
                id="question"
                value={questionText}
                onChange={(e) => {
                  setQuestionText(e.target.value);
                  setQuestionError("");
                }}
                onBlur={() => {
                  validateQuestionWithXHR(questionText).then((err) => {
                    if (err) setQuestionError(err);
                  });
                }}
                placeholder="Type your question here..."
              />
              {questionError && (
                <div className="error-message">{questionError}</div>
              )}
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn-submit"
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit Question"}
              </button>
              <button
                type="button"
                className="btn-rag"
                onClick={handleGetSuggestion}
                disabled={loadingRag}
              >
                {loadingRag ? "Getting AI Suggestion..." : "Get AI Suggestion"}
              </button>
            </div>

            {ragSuggestion && (
              <div className="rag-suggestion">
                <h4>
                  AI-Suggested Answer (Confidence:{" "}
                  {(ragSuggestion.confidence * 100).toFixed(0)}%)
                </h4>
                <p>{ragSuggestion.suggested_answer}</p>
                <p className="rag-confidence">
                  Sources: {ragSuggestion.sources.join(", ")}
                </p>
              </div>
            )}
          </form>
        </div>

        {/* Questions List */}
        <div className="questions-section">
          <div className="questions-header">
            <h2>Questions ({questions.length})</h2>
            <div className="filter-group">
              <label htmlFor="categoryFilter">Filter by Category:</label>
              <select
                id="categoryFilter"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="All">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading">Loading questions...</div>
          ) : questions.length === 0 ? (
            <div className="empty-state">
              <h3>No questions yet</h3>
              <p>Be the first to ask a question!</p>
            </div>
          ) : (
            questions.map((question) => (
              <div
                key={question.question_id}
                className={`question-card ${question.status.toLowerCase()}`}
              >
                <div className="question-header">
                  <div className="question-meta">
                    <span className="username">{question.username}</span>
                    <span className="timestamp">
                      {formatTimestamp(question.timestamp)}
                    </span>
                    <span className="category-badge">{question.category}</span>
                    <span
                      className={`status-badge ${question.status.toLowerCase()}`}
                    >
                      {question.status}
                    </span>
                  </div>
                </div>

                <div className="question-content">{question.message}</div>

                <div className="question-actions">
                  <button
                    className="btn-small btn-answer"
                    onClick={() => toggleAnswerForm(question.question_id)}
                  >
                    {showAnswerForm[question.question_id] ? "Hide" : "Answer"} (
                    {question.answer_count || 0})
                  </button>

                  {user && user.is_admin && (
                    <>
                      {question.status !== "Escalated" && (
                        <button
                          className="btn-small btn-escalate"
                          onClick={() =>
                            handleUpdateStatus(
                              question.question_id,
                              "Escalated"
                            )
                          }
                        >
                          Escalate
                        </button>
                      )}
                      {question.status !== "Answered" && (
                        <button
                          className="btn-small btn-mark-answered"
                          onClick={() =>
                            handleUpdateStatus(question.question_id, "Answered")
                          }
                        >
                          Mark Answered
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Answers Section */}
                {showAnswerForm[question.question_id] && (
                  <>
                    {/* Answer Form */}
                    <div className="answer-form">
                      {!user && (
                        <input
                          type="text"
                          value={answerGuestNames[question.question_id] || ""}
                          onChange={(e) =>
                            setAnswerGuestNames((prev) => ({
                              ...prev,
                              [question.question_id]: e.target.value,
                            }))
                          }
                          placeholder="Your name"
                          style={{ marginBottom: "10px" }}
                        />
                      )}
                      <textarea
                        value={answerTexts[question.question_id] || ""}
                        onChange={(e) =>
                          setAnswerTexts((prev) => ({
                            ...prev,
                            [question.question_id]: e.target.value,
                          }))
                        }
                        placeholder="Write your answer..."
                      />
                      <button
                        className="btn-small btn-answer"
                        onClick={() => handleSubmitAnswer(question.question_id)}
                      >
                        Submit Answer
                      </button>
                    </div>

                    {/* Answers List */}
                    {answers[question.question_id] &&
                      answers[question.question_id].length > 0 && (
                        <div className="answer-list">
                          <h4>Answers:</h4>
                          {answers[question.question_id].map((answer) => (
                            <div key={answer.answer_id} className="answer-item">
                              <div className="answer-meta">
                                <span className="username">
                                  {answer.username}
                                </span>
                                <span className="timestamp">
                                  {formatTimestamp(answer.timestamp)}
                                </span>
                              </div>
                              <div className="answer-content">
                                {answer.message}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
