"""Ephemeral Sonia MP3 generation for the Vercel Python runtime."""

import asyncio
import json
import logging
import re
import unicodedata
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler


LOGGER = logging.getLogger("metrovoiceover.tts")
VOICE = "en-GB-SoniaNeural"
DEFAULT_RATE = "+3%"
PITCH = "+0Hz"
VOLUME = "+0%"
MAX_BODY_BYTES = 16_000
MAX_TEXT_LENGTH = 2_000
GENERATION_TIMEOUT_SECONDS = 50
RATE_PATTERN = re.compile(r"^([+-]?\d{1,2})%$")


class RequestError(ValueError):
    """A request validation problem safe to show to the caller."""

    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


@dataclass(frozen=True)
class TTSRequest:
    text: str
    rate: str
    filename: str


def _filename_for(hint: object) -> str:
    raw_hint = hint if isinstance(hint, str) else ""
    ascii_hint = unicodedata.normalize("NFKD", raw_hint).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "_", ascii_hint.lower()).strip("_-")
    slug = re.sub(r"_+", "_", slug)[:48].strip("_-") or "announcement"
    return f"{slug}_sonia.mp3"


def parse_request(raw_body: bytes) -> TTSRequest:
    """Decode and validate the small JSON payload accepted by /api/tts."""
    if len(raw_body) > MAX_BODY_BYTES:
        raise RequestError(413, "payload_too_large", "The request is too large.")

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise RequestError(400, "invalid_json", "Enter an announcement and try again.") from None

    if not isinstance(payload, dict):
        raise RequestError(400, "invalid_json", "Enter an announcement and try again.")

    raw_text = payload.get("text")
    if not isinstance(raw_text, str):
        raise RequestError(400, "invalid_text", "Enter an announcement and try again.")

    text = raw_text.strip()
    if not text:
        raise RequestError(400, "empty_text", "Enter an announcement before generating audio.")
    if len(text) > MAX_TEXT_LENGTH:
        raise RequestError(413, "text_too_long", "Announcements must be 2,000 characters or fewer.")

    raw_rate = payload.get("rate", DEFAULT_RATE)
    match = RATE_PATTERN.fullmatch(raw_rate) if isinstance(raw_rate, str) else None
    if match is None:
        raise RequestError(400, "invalid_rate", "Choose a speed between −10% and +15%.")

    rate_value = int(match.group(1))
    if not -10 <= rate_value <= 15:
        raise RequestError(400, "invalid_rate", "Choose a speed between −10% and +15%.")

    return TTSRequest(
        text=text,
        rate=f"{rate_value:+d}%",
        filename=_filename_for(payload.get("filename_hint")),
    )


async def _collect_mp3(text: str, rate: str) -> bytes:
    import edge_tts

    communicate = edge_tts.Communicate(
        text,
        VOICE,
        rate=rate,
        pitch=PITCH,
        volume=VOLUME,
    )
    audio = bytearray()
    async for chunk in communicate.stream():
        if chunk.get("type") == "audio":
            audio.extend(chunk.get("data", b""))
    return bytes(audio)


def _looks_like_mp3(data: bytes) -> bool:
    if data.startswith(b"ID3"):
        return len(data) > 10
    return any(
        data[index] == 0xFF and data[index + 1] & 0xE0 == 0xE0
        for index in range(min(len(data) - 1, 4096))
    )


def _send_json(handler: BaseHTTPRequestHandler, status: int, code: str, message: str) -> None:
    body = json.dumps({"error": {"code": code, "message": message}}).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("X-Content-Type-Options", "nosniff")
    handler.end_headers()
    handler.wfile.write(body)


class handler(BaseHTTPRequestHandler):
    """Vercel's file-based Python HTTP handler for POST /api/tts."""

    def do_GET(self) -> None:
        _send_json(self, 405, "method_not_allowed", "Use POST to generate an announcement.")

    def do_POST(self) -> None:
        content_length = self.headers.get("Content-Length")
        if content_length is None:
            _send_json(self, 411, "content_length_required", "The request could not be read.")
            return

        try:
            body_length = int(content_length)
        except ValueError:
            _send_json(self, 400, "invalid_request", "The request could not be read.")
            return

        if body_length < 0 or body_length > MAX_BODY_BYTES:
            _send_json(self, 413, "payload_too_large", "The request is too large.")
            return

        raw_body = self.rfile.read(body_length)
        if len(raw_body) != body_length:
            _send_json(self, 400, "incomplete_request", "The request could not be read.")
            return

        try:
            request = parse_request(raw_body)
        except RequestError as error:
            _send_json(self, error.status_code, error.code, error.message)
            return

        try:
            audio = asyncio.run(
                asyncio.wait_for(
                    _collect_mp3(request.text, request.rate),
                    timeout=GENERATION_TIMEOUT_SECONDS,
                )
            )
        except TimeoutError:
            _send_json(self, 504, "generation_timeout", "Audio generation took too long. Please try again.")
            return
        except Exception as error:  # Edge TTS errors vary by network and upstream response.
            LOGGER.warning("Edge TTS request failed (%s).", type(error).__name__)
            _send_json(self, 502, "generation_failed", "Audio generation failed. Please try again.")
            return

        if not audio or not _looks_like_mp3(audio):
            LOGGER.warning("Edge TTS returned an empty or invalid MP3 response.")
            _send_json(self, 502, "invalid_audio", "Audio generation failed. Please try again.")
            return

        self.send_response(200)
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("Content-Length", str(len(audio)))
        self.send_header("Content-Disposition", f'attachment; filename="{request.filename}"')
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(audio)

    def log_message(self, format: str, *args: object) -> None:
        # Avoid default access logs that may contain request details.
        LOGGER.info("TTS request completed.")
