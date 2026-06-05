from __future__ import annotations

import asyncio
import signal
from typing import Callable

from client import PrintWorkerClient, PrintWorkerClientError
from config import Settings, require_realtime_settings
from worker_realtime import WorkerWakeupRealtimeClient


class PrintWorkerService:
    def __init__(
        self,
        client: PrintWorkerClient,
        settings: Settings,
        *,
        runner: Callable[[PrintWorkerClient, Settings], bool],
    ) -> None:
        require_realtime_settings(settings)
        self._client = client
        self._settings = settings
        self._runner = runner
        self._stop_event = asyncio.Event()
        self._claim_requested = asyncio.Event()
        self._claim_in_progress = False
        self._queued_claim = False
        self._fallback_task: asyncio.Task[None] | None = None
        self._realtime_client = WorkerWakeupRealtimeClient(settings, self.request_claim)
        self._scheduler_task: asyncio.Task[None] | None = None

    async def serve(self) -> int:
        self._install_signal_handlers()
        self.request_claim("startup")
        await self._realtime_client.start()
        self._scheduler_task = asyncio.create_task(
            self._claim_scheduler_loop(),
            name="worker-claim-scheduler",
        )
        self._fallback_task = asyncio.create_task(
            self._fallback_loop(),
            name="worker-fallback-claim",
        )

        await self._stop_event.wait()
        await self._shutdown()
        return 0

    def request_claim(self, reason: str) -> None:
        if self._stop_event.is_set():
            return

        if self._claim_in_progress:
            self._queued_claim = True
            return

        print(f"Claim requested -> reason={reason}")
        self._claim_requested.set()

    def request_shutdown(self, reason: str) -> None:
        if self._stop_event.is_set():
            return

        print(f"Shutdown requested -> reason={reason}")
        self._stop_event.set()
        self._claim_requested.set()

    async def _claim_scheduler_loop(self) -> None:
        while True:
            await self._claim_requested.wait()
            self._claim_requested.clear()

            if self._stop_event.is_set() and not self._queued_claim and not self._claim_in_progress:
                return

            await self._run_claim_cycle()

            if self._queued_claim and not self._stop_event.is_set():
                self._queued_claim = False
                self._claim_requested.set()
                continue

            if self._stop_event.is_set():
                return

    async def _run_claim_cycle(self) -> None:
        if self._claim_in_progress:
            self._queued_claim = True
            return

        self._claim_in_progress = True

        try:
            while True:
                had_job = await asyncio.to_thread(self._run_single_iteration)

                if not had_job or self._stop_event.is_set():
                    return
        finally:
            self._claim_in_progress = False

    def _run_single_iteration(self) -> bool:
        try:
            return self._runner(self._client, self._settings)
        except PrintWorkerClientError as error:
            print(f"Worker API error: {error}")
            return False

    async def _fallback_loop(self) -> None:
        interval_seconds = self._settings.realtime_fallback_claim_interval_seconds
        print(
            "Starting serve mode"
            f" -> fallbackClaimInterval={interval_seconds}s"
            f" devicePath={self._settings.printer_device_path}"
        )

        while not self._stop_event.is_set():
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=interval_seconds)
                return
            except asyncio.TimeoutError:
                self.request_claim("fallback")

    async def _shutdown(self) -> None:
        await self._realtime_client.stop()

        if self._fallback_task is not None:
            self._fallback_task.cancel()
            try:
                await self._fallback_task
            except asyncio.CancelledError:
                pass
            self._fallback_task = None

        if self._scheduler_task is not None:
            await self._scheduler_task
            self._scheduler_task = None

    def _install_signal_handlers(self) -> None:
        loop = asyncio.get_running_loop()

        for signal_name in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(
                    signal_name,
                    lambda handled_signal=signal_name: self.request_shutdown(
                        handled_signal.name
                    ),
                )
            except NotImplementedError:
                signal.signal(
                    signal_name,
                    lambda *_args, handled_signal=signal_name: self.request_shutdown(
                        handled_signal.name
                    ),
                )
