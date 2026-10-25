"""Unit: statement parser negative cases (FIN-02..04)."""

from __future__ import annotations

import pytest

from app.services.statements import parse_statement_bytes


def test_empty_csv_raises_controllable_error() -> None:
    """Empty body must raise ValueError (caught → FAILED 202), not raw _csv.Error."""
    with pytest.raises(ValueError, match="пуст"):
        parse_statement_bytes(b"", "empty.csv")


def test_whitespace_csv_raises_controllable_error() -> None:
    with pytest.raises(ValueError, match="пуст"):
        parse_statement_bytes(b"   \n\t  ", "ws.csv")


def test_unsupported_extension() -> None:
    with pytest.raises(ValueError, match="CSV и XLSX"):
        parse_statement_bytes(b"MZ", "malware.exe")


def test_header_only_csv_empty_ops() -> None:
    content = b"date,amount,direction,counterparty,purpose\n"
    with pytest.raises(ValueError, match="пуст|строк"):
        parse_statement_bytes(content, "header.csv")


def test_valid_minimal_csv() -> None:
    content = (
        b"date,amount,direction,counterparty,purpose\n"
        b"2026-09-03,85000,in,OOO Romashka,Payment\n"
    )
    rows = parse_statement_bytes(content, "ok.csv")
    assert len(rows) >= 1
