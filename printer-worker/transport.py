from __future__ import annotations


def write_raw_bytes_to_device(device_path: str, payload: bytes) -> None:
    with open(device_path, "wb") as printer_device:
        printer_device.write(payload)
        printer_device.flush()
