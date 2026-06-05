from __future__ import annotations

from typing import Any
import re


BARCODE_PATTERN = re.compile(r"^[A-Z0-9]{4,32}$")
DEFAULT_CUT_COMMAND = b"\x1D\x56\x42\x05"


class PrintPayloadError(Exception):
    pass


def _required_string(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)

    if not isinstance(value, str) or not value.strip():
        raise PrintPayloadError(f"Missing required {key} in print job payload.")

    return value.strip()


def _optional_string(payload: dict[str, Any], key: str, fallback: str) -> str:
    value = payload.get(key)

    if not isinstance(value, str):
        return fallback

    trimmed = value.strip()
    return trimmed or fallback


def _optional_integer(payload: dict[str, Any], key: str) -> int | None:
    value = payload.get(key)

    if isinstance(value, bool) or value is None:
        return None

    if isinstance(value, int):
        return value

    if isinstance(value, float) and value.is_integer():
        return int(value)

    if isinstance(value, str):
        trimmed = value.strip()
        if trimmed and re.fullmatch(r"-?\d+", trimmed):
            return int(trimmed)

    return None


def _optional_boolean(payload: dict[str, Any], key: str) -> bool | None:
    value = payload.get(key)

    if isinstance(value, bool):
        return value

    return None


def render_work_order_receipt(payload: dict[str, Any]) -> bytes:
    paper_order_no = _required_string(payload, "paperOrderNo")
    barcode_value = _required_string(payload, "barcodeValue")

    if not BARCODE_PATTERN.fullmatch(barcode_value):
        raise PrintPayloadError("Invalid barcodeValue in print job payload.")

    customer_name = _optional_string(payload, "customerNameAscii", "-")
    customer_phone = _optional_string(
        payload,
        "customerPhone",
        _optional_string(payload, "maskedPhone", "-"),
    )
    board_type = _optional_string(payload, "boardType", "-")
    estimated_completion_date = _optional_string(payload, "estimatedCompletionDate", "-")
    initial_quote_amount = _optional_integer(payload, "initialQuoteAmount")
    payment_received = _optional_boolean(payload, "paymentReceived")

    text_lines = [
        "BoardsReborn",
        f"Order: {paper_order_no}",
        f"Customer: {customer_name}",
        f"Phone: {customer_phone}",
        f"Board: {board_type}",
        f"ETA: {estimated_completion_date}",
        f"Quote: {'NT$' + str(initial_quote_amount) if initial_quote_amount is not None else '-'}",
        f"Paid: {'YES' if payment_received is True else 'NO' if payment_received is False else '-'}",
    ]

    try:
        text_bytes = "\n".join(text_lines).encode("ascii")
        barcode_bytes = barcode_value.encode("ascii")
    except UnicodeEncodeError as error:
        raise PrintPayloadError(str(error)) from error

    return b"".join(
        [
            b"\x1B\x40",
            text_bytes,
            b"\n",
            b"\x1D\x48\x02",
            b"\x1D\x68\x64",
            b"\x1D\x77\x02",
            b"\x1D\x6B\x04",
            barcode_bytes,
            b"\x00",
            b"\n\n",
            DEFAULT_CUT_COMMAND,
        ]
    )
