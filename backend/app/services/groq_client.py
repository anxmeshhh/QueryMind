"""Groq API client wrapper for LLM inference."""

import threading
from groq import Groq
from app.config import Config

_client = None
_client_lock = threading.Lock()


def _get_client() -> Groq:
    global _client
    if _client is None:
        with _client_lock:
            if _client is None:
                _client = Groq(api_key=Config.GROQ_API_KEY)
    return _client


def ask_groq(prompt: str, system: str = "You are a senior database engineer and SQL optimization expert. Keep responses highly concise, token-optimized, and return only the requested JSON/SQL structure without extra conversation.", max_tokens: int = None) -> str:
    """Send a prompt to Groq and return the response text."""
    client = _get_client()

    response = client.chat.completions.create(
        model=Config.GROQ_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        max_tokens=max_tokens or Config.GROQ_MAX_TOKENS,
        temperature=Config.GROQ_TEMPERATURE,
    )

    return response.choices[0].message.content
