from __future__ import annotations

import sys
from pathlib import Path
import unittest


WORKER_ROOT = Path(__file__).resolve().parents[1]
if str(WORKER_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKER_ROOT))

from renderer import (
    DEFAULT_CUT_COMMAND,
    PrintPayloadError,
    render_customer_receipt,
    render_print_job,
    render_work_order_receipt,
)


class RenderWorkOrderReceiptTest(unittest.TestCase):
    def test_renders_expected_receipt_bytes(self) -> None:
        payload = {
            "barcodeValue": "123456",
            "customerPhone": "0912927265",
            "displayOrderNumber": "123456",
            "intakeDate": "2026-06-05",
            "paperOrderNo": "260001",
            "paymentReceived": True,
            "repairCount": 6,
            "templateVersion": 2,
        }

        rendered = render_work_order_receipt(payload)

        self.assertTrue(rendered.startswith(b"\x1B\x40\x1D\x21\x11"))
        self.assertIn(b"In: 2026-06-05", rendered)
        self.assertIn(b"Tel: 0912927265", rendered)
        self.assertIn(b"Paid: YES", rendered)
        self.assertIn(
            b"\x1B\x61\x01\x1B\x56\x02\x1D\x21\x22123456\x1B\x56\x00\x1D\x21\x11(\x1B\x56\x02\x1D\x21\x226\x1B\x56\x00\x1D\x21\x11)",
            rendered,
        )
        self.assertIn(
            b"\x1D\x48\x00\x1D\x68\x40\x1D\x77\x02\x1D\x6B\x04123456\x00\x1B\x61\x00",
            rendered,
        )
        self.assertNotIn(b"\n\n\n", rendered)
        self.assertTrue(rendered.endswith(DEFAULT_CUT_COMMAND))

    def test_fails_for_missing_paper_order_number(self) -> None:
        with self.assertRaises(PrintPayloadError):
            render_work_order_receipt(
                {
                    "barcodeValue": "123456",
                    "customerPhone": "0912927265",
                    "displayOrderNumber": "123456",
                    "intakeDate": "2026-06-05",
                    "paymentReceived": True,
                    "repairCount": 6,
                    "templateVersion": 2,
                }
            )

    def test_fails_for_invalid_barcode_value(self) -> None:
        with self.assertRaises(PrintPayloadError):
            render_work_order_receipt(
                {
                    "barcodeValue": "br-2026-0001",
                    "customerPhone": "0912927265",
                    "displayOrderNumber": "123456",
                    "intakeDate": "2026-06-05",
                    "paperOrderNo": "260001",
                    "paymentReceived": True,
                    "repairCount": 6,
                    "templateVersion": 2,
                }
            )

    def test_fails_for_missing_repair_count(self) -> None:
        with self.assertRaises(PrintPayloadError):
            render_work_order_receipt(
                {
                    "barcodeValue": "123456",
                    "customerPhone": "0912927265",
                    "displayOrderNumber": "123456",
                    "intakeDate": "2026-06-05",
                    "paperOrderNo": "260001",
                    "paymentReceived": True,
                    "templateVersion": 2,
                }
            )

    def test_renders_customer_receipt_bytes(self) -> None:
        rendered = render_customer_receipt(
            {
                "boardTypeLabel": "衝浪板",
                "customerPhone": "0912345678",
                "intakeDate": "2026-06-05",
                "paperOrderNo": "123456",
                "paymentReceived": False,
                "publicLookupUrl": "http://localhost:3000/repair-status",
                "repairCount": 6,
                "templateVersion": 1,
            }
        )

        self.assertTrue(rendered.startswith(b"\x1B\x40\x1C\x26\x1B\x4C"))
        self.assertIn(b"\x1B\x57\x00\x00\x00\x00\x40\x02\x94\x02", rendered)
        self.assertIn("BoardsReborn 板再生維修收件單".encode("cp950"), rendered)
        self.assertIn("收件日: 2026-06-05".encode("cp950"), rendered)
        self.assertIn("付款: 未付款".encode("cp950"), rendered)
        self.assertIn(b"\x1D\x28\x6B\x04\x00\x31\x41\x32\x00", rendered)
        self.assertIn(b"\x1D\x28\x6B\x03\x00\x31\x51\x30", rendered)
        self.assertIn(b"http://localhost:3000/repair-status", rendered)
        self.assertIn(b"\x0C\x1B\x53", rendered)
        self.assertTrue(rendered.endswith(DEFAULT_CUT_COMMAND))

    def test_dispatches_by_print_job_type(self) -> None:
        label_payload = {
            "barcodeValue": "123456",
            "customerPhone": "0912927265",
            "displayOrderNumber": "123456",
            "intakeDate": "2026-06-05",
            "paperOrderNo": "260001",
            "paymentReceived": True,
            "repairCount": 6,
            "templateVersion": 2,
        }
        receipt_payload = {
            "boardTypeLabel": "SUP",
            "customerPhone": "0912345678",
            "intakeDate": "2026-06-05",
            "paperOrderNo": "123456",
            "paymentReceived": True,
            "publicLookupUrl": "http://localhost:3000/repair-status",
            "repairCount": 6,
            "templateVersion": 1,
        }

        self.assertIn(
            b"\x1D\x6B\x04123456\x00",
            render_print_job("work_order_label", label_payload),
        )
        self.assertIn(b"\x1C\x26\x1B\x4C", render_print_job("customer_receipt", receipt_payload))

        with self.assertRaises(PrintPayloadError):
            render_print_job("unknown", {})


if __name__ == "__main__":
    unittest.main()
