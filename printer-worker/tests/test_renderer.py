from __future__ import annotations

import sys
from pathlib import Path
import unittest


WORKER_ROOT = Path(__file__).resolve().parents[1]
if str(WORKER_ROOT) not in sys.path:
    sys.path.insert(0, str(WORKER_ROOT))

from renderer import DEFAULT_CUT_COMMAND, PrintPayloadError, render_work_order_receipt


class RenderWorkOrderReceiptTest(unittest.TestCase):
    def test_renders_expected_receipt_bytes(self) -> None:
        payload = {
            "barcodeValue": "BR20260601001",
            "boardType": "SURFBOARD",
            "customerNameAscii": "Alex",
            "customerPhone": "0912927265",
            "estimatedCompletionDate": "2026-06-10",
            "initialQuoteAmount": 1200,
            "paperOrderNo": "BR-20260601-001",
            "paymentReceived": True,
            "templateVersion": 1,
        }

        rendered = render_work_order_receipt(payload)

        self.assertTrue(rendered.startswith(b"\x1B\x40BoardsReborn"))
        self.assertIn(b"Order: BR-20260601-001", rendered)
        self.assertIn(b"Customer: Alex", rendered)
        self.assertIn(b"Phone: 0912927265", rendered)
        self.assertIn(b"Board: SURFBOARD", rendered)
        self.assertIn(b"ETA: 2026-06-10", rendered)
        self.assertIn(b"Quote: NT$1200", rendered)
        self.assertIn(b"Paid: YES", rendered)
        self.assertIn(
            b"\x1D\x48\x02\x1D\x68\x50\x1D\x77\x02\x1B\x61\x01\x1D\x6B\x04BR20260601001\x00\n\x1B\x61\x00",
            rendered,
        )
        self.assertNotIn(b"\n\n\n", rendered)
        self.assertTrue(rendered.endswith(DEFAULT_CUT_COMMAND))

    def test_uses_fallbacks_for_optional_fields(self) -> None:
        payload = {
            "barcodeValue": "BR20260601001",
            "paperOrderNo": "BR-20260601-001",
            "templateVersion": 1,
        }

        rendered = render_work_order_receipt(payload)

        self.assertIn(b"Customer: -", rendered)
        self.assertIn(b"Phone: -", rendered)
        self.assertIn(b"Board: -", rendered)
        self.assertIn(b"ETA: -", rendered)
        self.assertIn(b"Quote: -", rendered)
        self.assertIn(b"Paid: -", rendered)

    def test_keeps_backward_compatibility_for_masked_phone_payloads(self) -> None:
        payload = {
            "barcodeValue": "BR20260601001",
            "maskedPhone": "****7265",
            "paperOrderNo": "BR-20260601-001",
        }

        rendered = render_work_order_receipt(payload)

        self.assertIn(b"Phone: ****7265", rendered)

    def test_fails_for_missing_paper_order_number(self) -> None:
        with self.assertRaises(PrintPayloadError):
            render_work_order_receipt({"barcodeValue": "BR20260601001"})

    def test_fails_for_invalid_barcode_value(self) -> None:
        with self.assertRaises(PrintPayloadError):
            render_work_order_receipt(
                {
                    "barcodeValue": "br-2026-0001",
                    "paperOrderNo": "BR-20260601-001",
                }
            )


if __name__ == "__main__":
    unittest.main()
