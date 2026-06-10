from __future__ import annotations

from typing import Any
import re


BARCODE_PATTERN = re.compile(r"^[A-Z0-9]{4,32}$")
DEFAULT_CUT_COMMAND = b"\x1D\x56\x42\x05"
BARCODE_HEIGHT = b"\x40"
RECEIPT_TEXT_WIDTH = 42
RECEIPT_COLUMN_GAP = 2


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


def _required_integer(payload: dict[str, Any], key: str) -> int:
    value = payload.get(key)

    if isinstance(value, bool) or value is None:
        raise PrintPayloadError(f"Missing required {key} in print job payload.")

    if isinstance(value, int):
        integer_value = value
    elif isinstance(value, float) and value.is_integer():
        integer_value = int(value)
    elif isinstance(value, str):
        trimmed = value.strip()
        if trimmed and re.fullmatch(r"-?\d+", trimmed):
            integer_value = int(trimmed)
        else:
            raise PrintPayloadError(f"Missing required {key} in print job payload.")
    else:
        raise PrintPayloadError(f"Missing required {key} in print job payload.")

    if integer_value < 1:
        raise PrintPayloadError(f"Invalid {key} in print job payload.")

    return integer_value


def _required_boolean(payload: dict[str, Any], key: str) -> bool:
    value = payload.get(key)

    if isinstance(value, bool):
        return value

    raise PrintPayloadError(f"Missing required {key} in print job payload.")


def _required_ascii_bytes(payload: dict[str, Any], key: str) -> bytes:
    try:
        return _required_string(payload, key).encode("ascii")
    except UnicodeEncodeError as error:
        raise PrintPayloadError(str(error)) from error


def _center_text(left: str, multiplier: int = 1) -> str:
    visible_width = len(left) * multiplier
    padding = max(0, (RECEIPT_TEXT_WIDTH - visible_width) // 2)
    return (" " * padding) + left


def _two_column_line(left: str, right: str) -> str:
    left_text = left.strip()
    right_text = right.strip()
    available_padding = RECEIPT_TEXT_WIDTH - len(left_text) - len(right_text)

    if available_padding >= RECEIPT_COLUMN_GAP:
        return left_text + (" " * available_padding) + right_text

    return f"{left_text}{' ' * RECEIPT_COLUMN_GAP}{right_text}"


def render_work_order_receipt(payload: dict[str, Any]) -> bytes:
    template_version = _required_integer(payload, "templateVersion")
    paper_order_no = _required_ascii_bytes(payload, "paperOrderNo")
    display_order_number = _required_ascii_bytes(payload, "displayOrderNumber")
    intake_date = _required_ascii_bytes(payload, "intakeDate")
    barcode_value = _required_string(payload, "barcodeValue")
    customer_phone = _required_ascii_bytes(payload, "customerPhone")
    repair_count = _required_integer(payload, "repairCount")
    payment_received = _required_boolean(payload, "paymentReceived")

    if template_version != 2:
        raise PrintPayloadError("Unsupported templateVersion in print job payload.")

    if not BARCODE_PATTERN.fullmatch(barcode_value):
        raise PrintPayloadError("Invalid barcodeValue in print job payload.")

    try:
        barcode_bytes = barcode_value.encode("ascii")
    except UnicodeEncodeError as error:
        raise PrintPayloadError(str(error)) from error

    paid_display = b"YES" if payment_received else b"NO"
    date_line = _center_text(f"In: {intake_date.decode('ascii')}", multiplier=2).encode("ascii")
    phone_paid_line = _two_column_line(
        f"Tel: {customer_phone.decode('ascii')}",
        f"Paid: {paid_display.decode('ascii')}",
    ).encode("ascii")
    repair_count_bytes = str(repair_count).encode("ascii")

    return b"".join(
        [
            b"\x1B\x40",
            b"\x1D\x21\x11",
            date_line,
            b"\x1D\x21\x00\n",
            phone_paid_line,
            b"\n",
            b"\x1B\x61\x01",
            b"\x1B\x56\x02",
            b"\x1D\x21\x22",
            display_order_number,
            b"\x1B\x56\x00",
            b"\x1D\x21\x11",
            b"(",
            b"\x1B\x56\x02",
            b"\x1D\x21\x22",
            repair_count_bytes,
            b"\x1B\x56\x00",
            b"\x1D\x21\x11",
            b")",
            b"\x1D\x21\x00\n\n",
            b"\x1D\x48\x00",
            b"\x1D\x68" + BARCODE_HEIGHT,
            b"\x1D\x77\x02",
            b"\x1D\x6B\x04",
            barcode_bytes,
            b"\x00",
            b"\x1B\x61\x00",
            b"\n",
            DEFAULT_CUT_COMMAND,
        ]
    )
