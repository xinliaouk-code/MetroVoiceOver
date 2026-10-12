import json
import importlib
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

from api.tts import MAX_BODY_BYTES, MAX_TEXT_LENGTH, RequestError, _collect_mp3, parse_request


class SynthesisTests(unittest.IsolatedAsyncioTestCase):
    async def test_uses_current_endpoint_and_preserves_sonia_settings(self):
        import edge_tts
        from edge_tts.constants import TRUSTED_CLIENT_TOKEN

        transport = importlib.import_module("edge_tts.communicate")
        original_url = transport.WSS_URL
        calls = []

        class FakeCommunicate:
            def __init__(self, *args, **kwargs):
                calls.append((args, kwargs))

            async def stream(self):
                url = urlsplit(transport.WSS_URL)
                self_test.assertEqual(url.scheme, "wss")
                self_test.assertEqual(url.hostname, "api.msedgeservices.com")
                self_test.assertEqual(url.path, "/tts/cognitiveservices/websocket/v1")
                self_test.assertEqual(parse_qs(url.query), {
                    "Ocp-Apim-Subscription-Key": [TRUSTED_CLIENT_TOKEN],
                })
                yield {"type": "WordBoundary", "data": "ignored metadata"}
                yield {"type": "audio", "data": b"first"}
                yield {"type": "audio", "data": b"second"}

        self_test = self
        try:
            with patch.object(edge_tts, "Communicate", FakeCommunicate):
                self.assertEqual(await _collect_mp3("Test announcement", "-10%"), b"firstsecond")
            self.assertEqual(calls, [(("Test announcement", "en-GB-SoniaNeural"), {
                "rate": "-10%", "pitch": "+0Hz", "volume": "+0%",
            })])
        finally:
            transport.WSS_URL = original_url

    async def test_upstream_failure_does_not_return_partial_audio(self):
        import edge_tts

        transport = importlib.import_module("edge_tts.communicate")
        original_url = transport.WSS_URL

        class FailingCommunicate:
            def __init__(self, *args, **kwargs):
                pass

            async def stream(self):
                yield {"type": "audio", "data": b"partial"}
                raise ConnectionError("upstream disconnected")

        try:
            with patch.object(edge_tts, "Communicate", FailingCommunicate):
                with self.assertRaises(ConnectionError):
                    await _collect_mp3("Test announcement", "+3%")
        finally:
            transport.WSS_URL = original_url


class ParseRequestTests(unittest.TestCase):
    def parse(self, payload):
        return parse_request(json.dumps(payload).encode("utf-8"))

    def test_trims_text_and_uses_default_rate(self):
        request = self.parse({"text": "  Next train departs from platform four.  "})

        self.assertEqual(request.text, "Next train departs from platform four.")
        self.assertEqual(request.rate, "+3%")
        self.assertEqual(request.filename, "announcement_sonia.mp3")

    def test_rejects_empty_text_after_trimming(self):
        with self.assertRaises(RequestError) as raised:
            self.parse({"text": " \n  "})

        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(raised.exception.code, "empty_text")

    def test_rejects_text_over_limit(self):
        with self.assertRaises(RequestError) as raised:
            self.parse({"text": "a" * (MAX_TEXT_LENGTH + 1)})

        self.assertEqual(raised.exception.status_code, 413)
        self.assertEqual(raised.exception.code, "text_too_long")

    def test_rejects_body_over_limit_before_json_parsing(self):
        with self.assertRaises(RequestError) as raised:
            parse_request(b" " * (MAX_BODY_BYTES + 1))

        self.assertEqual(raised.exception.status_code, 413)
        self.assertEqual(raised.exception.code, "payload_too_large")

    def test_rejects_malformed_json_and_non_object_json(self):
        for body in (b"{", json.dumps(["text"]).encode("utf-8")):
            with self.subTest(body=body):
                with self.assertRaises(RequestError) as raised:
                    parse_request(body)

                self.assertEqual(raised.exception.status_code, 400)

    def test_accepts_rate_range_and_normalizes_sign(self):
        self.assertEqual(self.parse({"text": "Hello", "rate": "-10%"}).rate, "-10%")
        self.assertEqual(self.parse({"text": "Hello", "rate": "+15%"}).rate, "+15%")

    def test_rejects_rate_outside_supported_range(self):
        for rate in ("-11%", "+16%", "fast", "+3.5%"):
            with self.subTest(rate=rate):
                with self.assertRaises(RequestError) as raised:
                    self.parse({"text": "Hello", "rate": rate})

                self.assertEqual(raised.exception.code, "invalid_rate")

    def test_sanitizes_example_filename(self):
        request = self.parse({"text": "Hello", "filename_hint": "Platform Alteration #2"})

        self.assertEqual(request.filename, "platform_alteration_2_sonia.mp3")


if __name__ == "__main__":
    unittest.main()
