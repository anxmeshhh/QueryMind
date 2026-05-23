import unittest
import json
from app.main import app


class TestOTPRoute(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_send_and_verify_otp(self):
        # 1. Send OTP
        response = self.app.post(
            "/api/v1/send-otp",
            data=json.dumps({"email": "test@example.com"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data["status"], "sent")
        self.assertTrue("code" in data or not data["sandbox"])
        
        otp_code = data.get("code")
        if not otp_code:
            # If not sandbox mode (e.g. SMTP is configured in tests), skip verification test
            return

        # 2. Verify with invalid code
        response = self.app.post(
            "/api/v1/verify-otp",
            data=json.dumps({"email": "test@example.com", "code": "000000"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

        # 3. Verify with valid code
        response = self.app.post(
            "/api/v1/verify-otp",
            data=json.dumps({"email": "test@example.com", "code": otp_code}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data["status"], "verified")


if __name__ == "__main__":
    unittest.main()
