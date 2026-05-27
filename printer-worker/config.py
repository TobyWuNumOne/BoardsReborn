from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os


class ConfigurationError(Exception):
    pass


@dataclass(frozen=True)
class Settings:
    api_base_url: str
    device_key: str
    poll_interval_seconds: int
    print_worker_token: str
    realtime_fallback_claim_interval_seconds: int
    realtime_reconnect_max_seconds: int
    supabase_anon_key: str | None
    supabase_url: str | None
    worker_fail_message: str
    worker_result_mode: str


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()

        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        normalized_key = key.strip()

        if not normalized_key or normalized_key in os.environ:
            continue

        normalized_value = value.strip().strip("'").strip('"')
        os.environ[normalized_key] = normalized_value


def _require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()

    if not value:
        raise ConfigurationError(f"Missing required environment variable: {name}")

    return value


def _parse_positive_int(name: str, default: int) -> int:
    raw_value = os.environ.get(name, "").strip()

    if not raw_value:
        return default

    try:
        value = int(raw_value)
    except ValueError as error:
        raise ConfigurationError(f"{name} must be a positive integer.") from error

    if value < 1:
        raise ConfigurationError(f"{name} must be greater than 0.")

    return value


def load_settings() -> Settings:
    _load_env_file(Path(__file__).resolve().parent / ".env")

    api_base_url = _require_env("API_BASE_URL").rstrip("/")
    device_key = _require_env("DEVICE_KEY")
    print_worker_token = _require_env("PRINT_WORKER_TOKEN")
    poll_interval_seconds = _parse_positive_int("POLL_INTERVAL_SECONDS", 5)
    realtime_fallback_claim_interval_seconds = _parse_positive_int(
        "REALTIME_FALLBACK_CLAIM_INTERVAL_SECONDS", 60
    )
    realtime_reconnect_max_seconds = _parse_positive_int(
        "REALTIME_RECONNECT_MAX_SECONDS", 30
    )
    supabase_url = os.environ.get("SUPABASE_URL", "").strip() or None
    supabase_anon_key = os.environ.get("SUPABASE_ANON_KEY", "").strip() or None
    worker_result_mode = os.environ.get("WORKER_RESULT_MODE", "succeed").strip().lower() or "succeed"
    worker_fail_message = os.environ.get("WORKER_FAIL_MESSAGE", "Simulated print failure").strip()

    if worker_result_mode not in {"succeed", "fail"}:
        raise ConfigurationError("WORKER_RESULT_MODE must be either succeed or fail.")

    if not worker_fail_message:
        raise ConfigurationError("WORKER_FAIL_MESSAGE must not be empty.")

    return Settings(
        api_base_url=api_base_url,
        device_key=device_key,
        poll_interval_seconds=poll_interval_seconds,
        print_worker_token=print_worker_token,
        realtime_fallback_claim_interval_seconds=realtime_fallback_claim_interval_seconds,
        realtime_reconnect_max_seconds=realtime_reconnect_max_seconds,
        supabase_anon_key=supabase_anon_key,
        supabase_url=supabase_url.rstrip("/") if supabase_url else None,
        worker_fail_message=worker_fail_message,
        worker_result_mode=worker_result_mode,
    )


def require_realtime_settings(settings: Settings) -> tuple[str, str]:
    if not settings.supabase_url:
        raise ConfigurationError("SUPABASE_URL is required for `worker.py serve`.")

    if not settings.supabase_anon_key:
        raise ConfigurationError("SUPABASE_ANON_KEY is required for `worker.py serve`.")

    return settings.supabase_url, settings.supabase_anon_key
