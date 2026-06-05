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


def render_work_order_receipt(payload: dict[str, Any]) -> bytes:
    paper_order_no = _required_string(payload, "paperOrderNo")
    barcode_value = _required_string(payload, "barcodeValue")

    if not BARCODE_PATTERN.fullmatch(barcode_value):
        raise PrintPayloadError("Invalid barcodeValue in print job payload.")

    customer_name = _optional_string(payload, "customerNameAscii", "-")
    masked_phone = _optional_string(payload, "maskedPhone", "-")
    board_type = _optional_string(payload, "boardType", "-")

    text_lines = [
        "BoardsReborn",
        f"Order: {paper_order_no}",
        f"Customer: {customer_name}",
        f"Phone: {masked_phone}",
        f"Board: {board_type}",
        "",
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
            b"\n\n\n",
            DEFAULT_CUT_COMMAND,
        ]
    )
