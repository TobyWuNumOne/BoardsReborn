from __future__ import annotations

import sys
from pathlib import Path
import unittest


WORKER_ROOT = Path(__file__).resolve().parents[1]
if str(WORKER_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKER_ROOT))

from client import PrintJob
from config import Settings
from print_runner import handle_claimed_print_job


class FakeClient:
    def __init__(self) -> None:
        self.fail_calls: list[tuple[str, str]] = []
        self.success_calls: list[str] = []

    def mark_failure(self, job_id: str, error_message: str) -> dict[str, object]:
        self.fail_calls.append((job_id, error_message))
        return {
            "attemptCount": 1,
            "lastError": error_message,
            "status": "pending",
        }

    def mark_success(self, job_id: str) -> dict[str, object]:
        self.success_calls.append(job_id)
        return {
            "attemptCount": 0,
            "printedAt": "2026-06-05T00:00:00.000Z",
            "status": "printed",
        }


class HandleClaimedPrintJobTest(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = Settings(
            api_base_url="http://127.0.0.1:3000",
            device_key="raspi-print-worker-01",
            poll_interval_seconds=5,
            printer_device_path="/dev/usb/lp0",
            print_worker_token="token",
            realtime_fallback_claim_interval_seconds=60,
            realtime_reconnect_max_seconds=30,
            supabase_anon_key="anon",
            supabase_url="http://127.0.0.1:54321",
            worker_fail_message="Simulated print failure",
            worker_result_mode="succeed",
        )
        self.job = PrintJob(
            attempt_count=0,
            created_at="2026-06-05T00:00:00.000Z",
            id="job-1",
            job_type="work_order_label",
            locked_at="2026-06-05T00:00:01.000Z",
            max_attempts=3,
            payload={
                "barcodeValue": "BR20260601001",
                "boardType": "SURFBOARD",
                "customerNameAscii": "Alex",
                "customerPhone": "0912927265",
                "paperOrderNo": "BR-20260601-001",
                "templateVersion": 1,
            },
            work_order_id="work-order-1",
        )

    def test_marks_success_after_transport(self) -> None:
        client = FakeClient()
        transport_calls: list[tuple[str, bytes]] = []

        def transport(device_path: str, payload: bytes) -> None:
            transport_calls.append((device_path, payload))

        handle_claimed_print_job(client, self.settings, self.job, transport=transport)

        self.assertEqual(client.success_calls, ["job-1"])
        self.assertEqual(client.fail_calls, [])
        self.assertEqual(transport_calls[0][0], "/dev/usb/lp0")
        self.assertTrue(transport_calls[0][1].startswith(b"\x1B\x40"))

    def test_marks_failure_when_transport_raises(self) -> None:
        client = FakeClient()

        def transport(_device_path: str, _payload: bytes) -> None:
            raise OSError("device offline")

        handle_claimed_print_job(client, self.settings, self.job, transport=transport)

        self.assertEqual(client.success_calls, [])
        self.assertEqual(client.fail_calls, [("job-1", "device offline")])


if __name__ == "__main__":
    unittest.main()
