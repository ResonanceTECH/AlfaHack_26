"""Local performance smoke: latency + parallel reads (not a formal SLA)."""

from __future__ import annotations

import statistics
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import httpx
import pytest


def _timed(fn):
    t0 = time.perf_counter()
    out = fn()
    return (time.perf_counter() - t0) * 1000, out


def test_perf_credit_calc_p95(api_base: str, tokens: dict) -> None:
    samples = []
    for _ in range(20):
        ms, r = _timed(
            lambda: httpx.post(
                f"{api_base}/credit-calculations",
                headers={"Authorization": f"Bearer {tokens['ip']}"},
                json={
                    "amount": 1000000,
                    "termMonths": 12,
                    "annualRatePercent": 15,
                    "repaymentType": "annuity",
                },
                timeout=30.0,
            )
        )
        assert r.status_code == 200
        samples.append(ms)
    samples.sort()
    p50 = statistics.median(samples)
    p95 = samples[int(0.95 * (len(samples) - 1))]
    assert p95 < 2000, f"p95={p95:.1f}ms p50={p50:.1f}ms"
    print(f"PERF credit-calc p50={p50:.1f}ms p95={p95:.1f}ms")


def test_perf_parallel_company_reads(api_base: str, tokens: dict) -> None:
    def one():
        return httpx.get(
            f"{api_base}/companies",
            headers={"Authorization": f"Bearer {tokens['ip']}"},
            timeout=30.0,
        ).status_code

    codes = []
    with ThreadPoolExecutor(max_workers=10) as pool:
        futs = [pool.submit(one) for _ in range(20)]
        for f in as_completed(futs):
            codes.append(f.result())
    assert codes.count(200) >= 18, codes
