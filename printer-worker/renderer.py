from __future__ import annotations

from typing import Any
import re


BARCODE_PATTERN = re.compile(r"^[A-Z0-9]{4,32}$")
DEFAULT_CUT_COMMAND = b"\x1D\x56\x42\x05"
BARCODE_HEIGHT = b"\x40"
RECEIPT_TEXT_WIDTH = 42
RECEIPT_COLUMN_GAP = 2
CUSTOMER_RECEIPT_WIDTH = 576
CUSTOMER_RECEIPT_HEIGHT = 660


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


def _cp950_bytes(text: str) -> bytes:
    return text.encode("cp950", errors="replace")


def _le16(value: int) -> bytes:
    return bytes([value & 0xFF, (value >> 8) & 0xFF])


def _set_page_area(x: int, y: int, width: int, height: int) -> bytes:
    return b"\x1B\x57" + _le16(x) + _le16(y) + _le16(width) + _le16(height)


def _set_position(x: int, y: int) -> bytes:
    return b"\x1B\x24" + _le16(x) + b"\x1D\x24" + _le16(y)


def _qr_bytes(data: bytes, size: int = 4) -> bytes:
    length = len(data) + 3
    p_low = length % 256
    p_high = length // 256

    return b"".join(
        [
            b"\x1D\x28\x6B\x04\x00\x31\x41\x32\x00",
            b"\x1D\x28\x6B\x03\x00\x31\x43" + bytes([size]),
            b"\x1D\x28\x6B\x03\x00\x31\x45\x31",
            b"\x1D\x28\x6B" + bytes([p_low, p_high]) + b"\x31\x50\x30" + data,
            b"\x1D\x28\x6B\x03\x00\x31\x51\x30",
        ]
    )


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


def render_customer_receipt(payload: dict[str, Any]) -> bytes:
    template_version = _required_integer(payload, "templateVersion")
    paper_order_no = _required_string(payload, "paperOrderNo")
    intake_date = _required_string(payload, "intakeDate")
    customer_phone = _required_string(payload, "customerPhone")
    board_type_label = _required_string(payload, "boardTypeLabel")
    repair_count = _required_integer(payload, "repairCount")
    payment_received = _required_boolean(payload, "paymentReceived")
    public_lookup_url = _required_ascii_bytes(payload, "publicLookupUrl")

    if template_version != 1:
        raise PrintPayloadError("Unsupported templateVersion in print job payload.")

    payment_label = "已付款" if payment_received else "未付款"

    return b"".join(
        [
            b"\x1B\x40",
            b"\x1C\x26",
            b"\x1B\x4C",
            _set_page_area(0, 0, CUSTOMER_RECEIPT_WIDTH, CUSTOMER_RECEIPT_HEIGHT),
            _set_position(20, 60),
            b"\x1D\x21\x01",
            _cp950_bytes("BoardsReborn 板再生維修收件單"),
            b"\x1D\x21\x00",
            _set_position(20, 125),
            _cp950_bytes(f"收件日: {intake_date}"),
            _set_position(20, 185),
            _cp950_bytes(f"工單號: {paper_order_no}"),
            _set_position(20, 245),
            _cp950_bytes(f"電話: {customer_phone}"),
            _set_position(20, 305),
            _cp950_bytes(f"板型: {board_type_label}"),
            _set_position(20, 365),
            _cp950_bytes(f"維修處數: {repair_count}"),
            _set_position(20, 425),
            _cp950_bytes(f"付款: {payment_label}"),
            _set_position(390, 125),
            _cp950_bytes(" "),
            _set_position(370, 155),
            _qr_bytes(public_lookup_url, size=4),
            _set_position(20, 535),
            _cp950_bytes("取板前務必請先來電預約，取件請出示本單！"),
            b"\x0C",
            b"\x1B\x53",
            b"\n\n",
            DEFAULT_CUT_COMMAND,
        ]
    )


def render_print_job(job_type: str, payload: dict[str, Any]) -> bytes:
    if job_type == "work_order_label":
        return render_work_order_receipt(payload)

    if job_type == "customer_receipt":
        return render_customer_receipt(payload)

    raise PrintPayloadError(f"Unsupported print job type: {job_type}")
