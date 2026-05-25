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


def ask_groq(
    prompt: str,
    system: str = "You are a senior database engineer and SQL optimization expert. Keep responses highly concise, token-optimized, and return only the requested JSON/SQL structure without extra conversation.",
    max_tokens: int = None,
    json_mode: bool = False,
    messages: list = None,
) -> str:
    """Send a prompt to Groq and return the response text.

    Args:
        prompt: User message (used when `messages` is not provided)
        system: System prompt (used when `messages` is not provided)
        max_tokens: Max tokens for the response
        json_mode: Whether to request JSON output
        messages: Full conversation history as a list of {role, content} dicts.
                  When provided, `prompt` and `system` are ignored.
    """
    client = _get_client()

    kwargs = {
        "model": Config.GROQ_MODEL,
        "messages": messages if messages else [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": max_tokens or Config.GROQ_MAX_TOKENS,
        "temperature": Config.GROQ_TEMPERATURE,
    }

    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    response = client.chat.completions.create(**kwargs)
    return response.choices[0].message.content
