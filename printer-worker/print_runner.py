from __future__ import annotations

from typing import Callable

from client import PrintJob, PrintWorkerClient
from config import Settings
from renderer import render_print_job
from transport import write_raw_bytes_to_device


def summarize_job(job: PrintJob) -> None:
    payload = job.payload
    print("Claimed print job")
    print(f"- id: {job.id}")
    print(f"- jobType: {job.job_type}")
    print(f"- paperOrderNo: {payload.get('paperOrderNo', '—')}")
    print(f"- templateVersion: {payload.get('templateVersion', '—')}")
    print(f"- displayOrderNumber: {payload.get('displayOrderNumber', '—')}")
    print(f"- barcodeValue: {payload.get('barcodeValue', '—')}")
    print(f"- intakeDate: {payload.get('intakeDate', '—')}")
    print(f"- customerPhone: {payload.get('customerPhone', '—')}")
    print(f"- boardTypeLabel: {payload.get('boardTypeLabel', '—')}")
    print(f"- paymentReceived: {payload.get('paymentReceived', '—')}")
    print(f"- repairCount: {payload.get('repairCount', '—')}")
    print(f"- qrKind: {payload.get('qrKind', 'legacy')}")


def _format_failure_message(error: Exception) -> str:
    message = str(error).strip() or error.__class__.__name__
    return message[:500]


def handle_claimed_print_job(
    client: PrintWorkerClient,
    settings: Settings,
    job: PrintJob,
    *,
    renderer: Callable[[str, dict[str, object]], bytes] = render_print_job,
    transport: Callable[[str, bytes], None] = write_raw_bytes_to_device,
) -> None:
    summarize_job(job)

    try:
        receipt_bytes = renderer(job.job_type, job.payload)
        transport(settings.printer_device_path, receipt_bytes)
    except Exception as error:
        result = client.mark_failure(job.id, _format_failure_message(error))
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


def run_print_once(client: PrintWorkerClient, settings: Settings) -> bool:
    job = client.claim_job()

    if job is None:
        print("No job available")
        return False

    handle_claimed_print_job(client, settings, job)
    return True
