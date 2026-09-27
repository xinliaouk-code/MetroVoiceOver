import json
import unittest

from api.tts import MAX_BODY_BYTES, MAX_TEXT_LENGTH, RequestError, parse_request


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
