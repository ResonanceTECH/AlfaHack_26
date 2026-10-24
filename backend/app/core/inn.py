from __future__ import annotations


def inn10_checksum(base9: str) -> str:
    if len(base9) != 9 or not base9.isdigit():
        raise ValueError("base9: 9 цифр")
    w = [2, 4, 10, 3, 5, 9, 4, 6, 8]
    digits = [int(c) for c in base9]
    return base9 + str(sum(d * ww for d, ww in zip(digits, w)) % 11 % 10)


def inn12_checksum(base10: str) -> str:
    if len(base10) != 10 or not base10.isdigit():
        raise ValueError("base10: 10 цифр")
    w1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
    w2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]
    d = [int(c) for c in base10]
    n11 = sum(x * ww for x, ww in zip(d, w1)) % 11 % 10
    d11 = d + [n11]
    n12 = sum(x * ww for x, ww in zip(d11, w2)) % 11 % 10
    return base10 + str(n11) + str(n12)


def is_valid_inn(inn: str) -> bool:
    if not inn.isdigit():
        return False
    if len(inn) == 10:
        return inn10_checksum(inn[:9]) == inn
    if len(inn) == 12:
        return inn12_checksum(inn[:10]) == inn
    return False
