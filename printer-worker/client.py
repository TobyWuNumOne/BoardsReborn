from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import requests

from config import Settings


class PrintWorkerClientError(Exception):
    pass


@dataclass(frozen=True)
class PrintJob:
    attempt_count: int
    created_at: str
    id: str
    job_type: str
    locked_at: str
    max_attempts: int
    payload: dict[str, Any]
    work_order_id: str


class PrintWorkerClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._session = requests.Session()
        self._session.headers.update(
            {
                "Accept": "application/json",
                "Authorization": f"Bearer {settings.print_worker_token}",
                "Content-Type": "application/json",
                "User-Agent": "boards-reborn-printer-worker/1.0",
            }
        )

    def claim_job(self) -> PrintJob | None:
        response = self._request(
            "POST",
            "/api/print-worker/jobs/claim",
            {"deviceKey": self._settings.device_key},
        )
        job = response["data"]["job"]

        if job is None:
            return None

        return PrintJob(
            attempt_count=int(job["attemptCount"]),
            created_at=str(job["createdAt"]),
            id=str(job["id"]),
            job_type=str(job["jobType"]),
            locked_at=str(job["lockedAt"]),
            max_attempts=int(job["maxAttempts"]),
            payload=dict(job.get("payload") or {}),
            work_order_id=str(job["workOrderId"]),
        )

    def mark_success(self, job_id: str) -> dict[str, Any]:
        response = self._request(
            "POST",
            f"/api/print-worker/jobs/{job_id}/succeed",
            {"deviceKey": self._settings.device_key},
        )
        return dict(response["data"])

    def mark_failure(self, job_id: str, error_message: str) -> dict[str, Any]:
        response = self._request(
            "POST",
            f"/api/print-worker/jobs/{job_id}/fail",
            {"deviceKey": self._settings.device_key, "error": error_message},
        )
        return dict(response["data"])

    def _request(self, method: str, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self._settings.api_base_url}{path}"

        try:
            response = self._session.request(method, url, json=payload, timeout=15)
        except requests.RequestException as error:
            raise PrintWorkerClientError(f"Request to {url} failed: {error}") from error

        if response.status_code >= 400:
            raise PrintWorkerClientError(self._format_error(response))

        try:
            body = response.json()
        except ValueError as error:
            raise PrintWorkerClientError(f"{method} {path} returned non-JSON response.") from error

        if not isinstance(body, dict) or "data" not in body:
            raise PrintWorkerClientError(f"{method} {path} returned an unexpected response shape.")

        return body

    def _format_error(self, response: requests.Response) -> str:
        method = response.request.method if response.request else "REQUEST"
        path = response.request.path_url if response.request else response.url
        status = response.status_code
        message = self._extract_error_message(response)

        if status == 401:
            return f"{method} {path} failed with 401 Unauthorized: {message}"
        if status == 403:
            return f"{method} {path} failed with 403 Forbidden: {message}"
        if status == 422:
            return f"{method} {path} failed with 422 Validation Error: {message}"
        if status >= 500:
            return f"{method} {path} failed with {status} Server Error: {message}"

        return f"{method} {path} failed with {status}: {message}"

    @staticmethod
    def _extract_error_message(response: requests.Response) -> str:
        try:
            body = response.json()
        except ValueError:
            text = response.text.strip()
            return text or "Unknown error"

        if isinstance(body, dict):
            error = body.get("error")
            if isinstance(error, dict):
                message = error.get("message")
                if isinstance(message, str) and message.strip():
                    return message.strip()

        return "Unknown error"
