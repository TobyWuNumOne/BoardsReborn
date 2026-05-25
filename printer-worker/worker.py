from __future__ import annotations

import argparse
import sys
import time
from typing import Sequence

from client import PrintJob, PrintWorkerClient, PrintWorkerClientError
from config import ConfigurationError, Settings, load_settings


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="BoardsReborn connectivity-first print worker.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("run-once", help="Claim and handle at most one print job, then exit.")
    subparsers.add_parser("poll", help="Poll the print-worker API continuously.")
    return parser


def summarize_job(job: PrintJob) -> None:
    payload = job.payload
    print("Claimed print job")
    print(f"- id: {job.id}")
    print(f"- jobType: {job.job_type}")
    print(f"- paperOrderNo: {payload.get('paperOrderNo', '—')}")
    print(f"- customerName: {payload.get('customerName', '—')}")
    print(f"- boardType: {payload.get('boardType', '—')}")


def handle_claimed_job(client: PrintWorkerClient, settings: Settings, job: PrintJob) -> None:
    summarize_job(job)

    if settings.worker_result_mode == "fail":
        result = client.mark_failure(job.id, settings.worker_fail_message)
        print(
            "Reported fail"
            f" -> status={result.get('status')} attemptCount={result.get('attemptCount')}"
            f" lastError={result.get('lastError')}"
        )
        return

    result = client.mark_success(job.id)
    print(
        "Reported success"
        f" -> status={result.get('status')} attemptCount={result.get('attemptCount')}"
        f" printedAt={result.get('printedAt')}"
    )


def run_once(client: PrintWorkerClient, settings: Settings) -> bool:
    job = client.claim_job()

    if job is None:
        print("No job available")
        return False

    handle_claimed_job(client, settings, job)
    return True


def poll_forever(client: PrintWorkerClient, settings: Settings) -> int:
    print(
        "Starting poll loop"
        f" -> interval={settings.poll_interval_seconds}s mode={settings.worker_result_mode}"
    )

    try:
        while True:
            try:
                run_once(client, settings)
            except PrintWorkerClientError as error:
                print(f"Worker API error: {error}", file=sys.stderr)
            time.sleep(settings.poll_interval_seconds)
    except KeyboardInterrupt:
        print("Stopped by user")
        return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        settings = load_settings()
        client = PrintWorkerClient(settings)

        if args.command == "run-once":
            run_once(client, settings)
            return 0

        if args.command == "poll":
            return poll_forever(client, settings)
    except ConfigurationError as error:
        print(f"Configuration error: {error}", file=sys.stderr)
        return 1
    except PrintWorkerClientError as error:
        print(f"Worker API error: {error}", file=sys.stderr)
        return 1
    except Exception as error:
        print(f"Unexpected error: {error}", file=sys.stderr)
        return 1

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
