import os
from typing import List
from dotenv import load_dotenv
import random

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")


class RAGService:
    """
    RAG (Retrieval-Augmented Generation) service for auto-suggesting answers.
    Uses Langchain with OpenAI for real implementation, or mock responses for demo.
    """

    def __init__(self):
        self.has_api_key = bool(OPENAI_API_KEY)
        self.llm = None

        print(f"RAGService initialized. OpenAI API Key found: {self.has_api_key}")

        if self.has_api_key:
            try:
                from langchain_openai import ChatOpenAI
                from langchain_core.prompts import ChatPromptTemplate
                from langchain_core.output_parsers import StrOutputParser

                self.llm = ChatOpenAI(
                    model="gpt-3.5-turbo",
                    temperature=0.7,
                    openai_api_key=OPENAI_API_KEY
                )

                self.prompt_template = ChatPromptTemplate.from_messages([
                    ("system", """You are a helpful Q&A assistant. Provide concise, accurate answers to user questions.
                    If you're not sure about something, say so. Keep answers under 200 words."""),
                    ("user", "{question}")
                ])

                self.chain = self.prompt_template | self.llm | StrOutputParser()
            except Exception as e:
                print(f"Failed to initialize OpenAI: {e}. Using mock responses.")
                self.llm = None

    async def get_suggested_answer(self, question: str) -> dict:
        """
        Get a suggested answer for a question.

        Args:
            question: The question text

        Returns:
            dict with suggested_answer, confidence, and sources
        """
        if self.llm:
            return await self._get_real_answer(question)
        else:
            return self._get_mock_answer(question)

    async def _get_real_answer(self, question: str) -> dict:
        """Get answer using actual Langchain/OpenAI."""
        try:
            answer = await self.chain.ainvoke({"question": question})
            return {
                "question": question,
                "suggested_answer": answer,
                "confidence": 0.85,
                "sources": ["OpenAI GPT-3.5", "Langchain RAG"]
            }
        except Exception as e:
            print(f"Error getting real answer: {e}")
            return self._get_mock_answer(question)

    def _get_mock_answer(self, question: str) -> dict:
        """Generate a mock answer for demo purposes."""
        question_lower = question.lower()

        mock_responses = {
            "how": "To accomplish this, you would typically follow these steps: 1) Research the requirements, 2) Plan your approach, 3) Implement the solution, 4) Test thoroughly. This is a general framework that can be adapted to your specific needs.",
            "what": "This is a great question! Based on common knowledge, the answer involves understanding the core concepts and applying them to your specific context. I'd recommend researching more about the specific topic you're asking about.",
            "why": "There are several reasons for this: 1) Historical context, 2) Technical requirements, 3) Best practices in the field. Understanding these factors will help clarify the reasoning behind it.",
            "when": "The timing for this depends on several factors including your specific requirements and constraints. Generally, it's best to consider the context and plan accordingly.",
            "where": "The location or placement depends on your specific use case. Common approaches include considering accessibility, performance, and maintainability factors."
        }

        for keyword, response in mock_responses.items():
            if question_lower.startswith(keyword):
                confidence = random.uniform(0.65, 0.85)
                return {
                    "question": question,
                    "suggested_answer": response,
                    "confidence": round(confidence, 2),
                    "sources": ["Mock RAG System", "Demo Knowledge Base"]
                }

        return {
            "question": question,
            "suggested_answer": "Thank you for your question! This is an interesting topic. I suggest researching authoritative sources or consulting with domain experts for the most accurate and up-to-date information. If you'd like a more specific answer, please provide additional context or details.",
            "confidence": 0.60,
            "sources": ["Mock RAG System", "General Knowledge Base"]
        }


rag_service = RAGService()
