from __future__ import annotations

import asyncio
from urllib.parse import urlsplit, urlunsplit
from typing import Any, Callable

from realtime import AsyncRealtimeClient
from realtime.types import BroadcastPayload, RealtimeSubscribeStates

from config import Settings, require_realtime_settings


def build_realtime_url(base_url: str) -> str:
    parts = urlsplit(base_url)
    path = parts.path.rstrip('/')

    if path.endswith('/realtime/v1'):
        realtime_path = path
    else:
        realtime_path = f'{path}/realtime/v1' if path else '/realtime/v1'

    return urlunsplit((parts.scheme, parts.netloc, realtime_path, '', ''))


class WorkerWakeupRealtimeClient:
    def __init__(
        self,
        settings: Settings,
        on_wakeup: Callable[[str], None],
    ) -> None:
        self._settings = settings
        self._on_wakeup = on_wakeup
        self._stop_event = asyncio.Event()
        self._task: asyncio.Task[None] | None = None
        self._realtime: AsyncRealtimeClient | None = None
        self._channel: Any | None = None

    async def start(self) -> None:
        if self._task is not None:
            return

        self._task = asyncio.create_task(self._run(), name="worker-realtime-loop")

    async def stop(self) -> None:
        self._stop_event.set()

        if self._task is not None:
            await self._task
            self._task = None

    async def _run(self) -> None:
        reconnect_delay_seconds = 1

        while not self._stop_event.is_set():
            try:
                await self._connect_once()
                reconnect_delay_seconds = 1
                await self._wait_until_disconnected()
            except Exception as error:
                if self._stop_event.is_set():
                    break

                print(f"Realtime connection error: {error}")
            finally:
                await self._cleanup_connection()

            if self._stop_event.is_set():
                break

            wait_seconds = min(
                reconnect_delay_seconds,
                self._settings.realtime_reconnect_max_seconds,
            )
            print(f"Realtime disconnected; retrying in {wait_seconds}s")

            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=wait_seconds)
                break
            except asyncio.TimeoutError:
                reconnect_delay_seconds = min(
                    reconnect_delay_seconds * 2,
                    self._settings.realtime_reconnect_max_seconds,
                )

    async def _connect_once(self) -> None:
        supabase_url, supabase_anon_key = require_realtime_settings(self._settings)
        self._realtime = AsyncRealtimeClient(
            build_realtime_url(supabase_url),
            token=supabase_anon_key,
            auto_reconnect=False,
            initial_backoff=1.0,
            max_retries=1,
        )
        await self._realtime.connect()
        self._channel = self._realtime.channel("printing:worker-wakeup")
        self._channel.on_broadcast("printing.job_available", self._handle_broadcast)

        subscription_state_changed = asyncio.Event()
        channel_error: dict[str, Exception | None] = {"value": None}

        def on_subscribe(status: RealtimeSubscribeStates, error: Exception | None) -> None:
            if status == RealtimeSubscribeStates.SUBSCRIBED:
                print("Realtime subscribed -> printing:worker-wakeup")
                subscription_state_changed.set()
                return

            if status in {
                RealtimeSubscribeStates.CHANNEL_ERROR,
                RealtimeSubscribeStates.CLOSED,
                RealtimeSubscribeStates.TIMED_OUT,
            }:
                channel_error["value"] = error or Exception(status.value)
                subscription_state_changed.set()

        await self._channel.subscribe(on_subscribe)
        await subscription_state_changed.wait()

        if channel_error["value"] is not None:
            raise channel_error["value"]

    async def _wait_until_disconnected(self) -> None:
        assert self._realtime is not None

        while not self._stop_event.is_set():
            if not self._realtime.is_connected:
                return

            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=1)
                return
            except asyncio.TimeoutError:
                continue

    async def _cleanup_connection(self) -> None:
        if self._realtime is None:
            return

        try:
            if self._channel is not None:
                await self._channel.unsubscribe()
            await self._realtime.close()
        except Exception:
            pass
        finally:
            self._channel = None
            self._realtime = None

    def _handle_broadcast(self, payload: BroadcastPayload) -> None:
        inner_payload = payload.get("payload") or {}

        if not isinstance(inner_payload, dict):
            return

        reason = inner_payload.get("reason")
        reason_label = reason if isinstance(reason, str) and reason else "event"
        print(f"Realtime wake-up received -> reason={reason_label}")
        self._on_wakeup(reason_label)
