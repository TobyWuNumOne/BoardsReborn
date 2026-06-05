from __future__ import annotations

import asyncio
import sys
from pathlib import Path
import types
import unittest


WORKER_ROOT = Path(__file__).resolve().parents[1]
if str(WORKER_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKER_ROOT))

fake_realtime_module = types.ModuleType("realtime")
fake_realtime_types_module = types.ModuleType("realtime.types")


class _FakeRealtimeSubscribeState:
    def __init__(self, value: str) -> None:
        self.value = value


class RealtimeSubscribeStates:
    SUBSCRIBED = _FakeRealtimeSubscribeState("SUBSCRIBED")
    CHANNEL_ERROR = _FakeRealtimeSubscribeState("CHANNEL_ERROR")
    CLOSED = _FakeRealtimeSubscribeState("CLOSED")
    TIMED_OUT = _FakeRealtimeSubscribeState("TIMED_OUT")


fake_realtime_module.AsyncRealtimeClient = object
fake_realtime_types_module.BroadcastPayload = dict
fake_realtime_types_module.RealtimeSubscribeStates = RealtimeSubscribeStates

sys.modules.setdefault("realtime", fake_realtime_module)
sys.modules.setdefault("realtime.types", fake_realtime_types_module)

from config import Settings
from worker_realtime import WorkerWakeupRealtimeClient


class WorkerWakeupRealtimeClientTest(unittest.TestCase):
    def setUp(self) -> None:
        self.reasons: list[str] = []
        self.settings = Settings(
            api_base_url="http://127.0.0.1:3000",
            device_key="raspi-print-worker-01",
            poll_interval_seconds=5,
            printer_device_path="/dev/usb/lp0",
            print_worker_token="token",
            realtime_fallback_claim_interval_seconds=15,
            realtime_reconnect_max_seconds=30,
            supabase_anon_key="anon",
            supabase_url="http://127.0.0.1:54321",
            worker_fail_message="Simulated print failure",
            worker_result_mode="succeed",
        )
        self.client = WorkerWakeupRealtimeClient(
            self.settings,
            self.reasons.append,
        )

    def test_reconnect_subscription_requests_immediate_claim(self) -> None:
        first_event = asyncio.Event()
        second_event = asyncio.Event()
        channel_error: dict[str, Exception | None] = {"value": None}

        self.client._handle_subscribe_status(
            RealtimeSubscribeStates.SUBSCRIBED,
            None,
            first_event,
            channel_error,
        )
        self.assertTrue(first_event.is_set())
        self.assertEqual(self.reasons, [])

        self.client._handle_subscribe_status(
            RealtimeSubscribeStates.SUBSCRIBED,
            None,
            second_event,
            channel_error,
        )
        self.assertTrue(second_event.is_set())
        self.assertEqual(self.reasons, ["reconnected"])


if __name__ == "__main__":
    unittest.main()
