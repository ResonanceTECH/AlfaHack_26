"""Unit: INN checksum validation."""

from __future__ import annotations

import pytest

from app.core.inn import inn10_checksum, inn12_checksum, is_valid_inn


@pytest.mark.parametrize(
    "inn,expected",
    [
        ("7701234560", True),
        ("770123456703", True),
        ("7709876545", True),
        ("123", False),
        ("abcdefghij", False),
        ("77012345601", False),
        ("", False),
        ("7701234569", False),
        ("7701234567 03", False),
    ],
)
def test_is_valid_inn(inn: str, expected: bool) -> None:
    assert is_valid_inn(inn) is expected


def test_inn10_roundtrip() -> None:
    full = inn10_checksum("770123456")
    assert len(full) == 10
    assert is_valid_inn(full)


def test_inn12_roundtrip() -> None:
    full = inn12_checksum("7701234567")
    assert len(full) == 12
    assert is_valid_inn(full)


def test_inn10_bad_base() -> None:
    with pytest.raises(ValueError):
        inn10_checksum("12")
