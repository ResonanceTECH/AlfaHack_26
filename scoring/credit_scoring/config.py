"""Загрузка и валидация конфига скоринга."""
from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

import yaml

DEFAULT_CONFIG_PATH = Path(__file__).parent / "config" / "scoring.yaml"
OPS = {"eq", "ne", "lt", "lte", "gt", "gte"}
ACTIONS = {"reject", "manual_review"}
PRODUCT_KEYS = {"min_amount", "max_amount", "min_term_months", "max_term_months", "min_company_age_months", "bands"}
BAND_KEYS = {"max_revenue_multiple", "max_amount", "max_term_months", "annual_rate", "auto_approve"}


class ConfigError(ValueError):
    pass


def load_config(path: Optional[str | Path] = None) -> dict[str, Any]:
    with open(path or DEFAULT_CONFIG_PATH, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    validate_config(cfg)
    return cfg


def validate_config(cfg: dict[str, Any]) -> None:
    for key in ("version", "base_score", "risk_bands", "stop_rules", "sector_risk", "factors", "products"):
        if key not in cfg:
            raise ConfigError(f"missing section: {key}")

    band_ids = [b["band"] for b in cfg["risk_bands"]]
    mins = [b["min_score"] for b in cfg["risk_bands"]]
    if mins[-1] is not None or any(m is None for m in mins[:-1]):
        raise ConfigError("risk_bands: only the last band may have min_score null")
    if any(a <= b for a, b in zip(mins[:-2], mins[1:-1])):
        raise ConfigError("risk_bands: min_score must strictly decrease")

    for r in cfg["stop_rules"]:
        if r["op"] not in OPS or r["action"] not in ACTIONS:
            raise ConfigError(f"stop rule {r.get('id')}: bad op or action")

    for f in cfg["factors"]:
        _validate_factor(f)

    factor_ids = [f["id"] for f in cfg["factors"]]
    if len(set(factor_ids)) != len(factor_ids):
        raise ConfigError("factor ids must be unique")
    grouped = set()
    group_ids = set()
    for group in cfg.get("factor_groups", []):
        members = group.get("factors", [])
        if not group.get("id") or group["id"] in group_ids:
            raise ConfigError("factor group ids must be nonempty and unique")
        if (not members or len(set(members)) != len(members)
                or not set(members) <= set(factor_ids) or grouped.intersection(members)):
            raise ConfigError("factor groups must contain unique known nonoverlapping factors")
        if type(group.get("min_points")) is not int or group["min_points"] > 0:
            raise ConfigError("factor group min_points must be a nonpositive integer")
        grouped.update(members)
        group_ids.add(group["id"])

    for pid, p in cfg["products"].items():
        if not PRODUCT_KEYS <= p.keys():
            raise ConfigError(f"product {pid}: missing keys {PRODUCT_KEYS - p.keys()}")
        for band, bp in p["bands"].items():
            if band not in band_ids or band == band_ids[-1]:
                raise ConfigError(f"product {pid}: band {band} is unknown or lowest (lowest band is always rejected)")
            if not BAND_KEYS <= bp.keys():
                raise ConfigError(f"product {pid}/{band}: missing keys {BAND_KEYS - bp.keys()}")
        _check_policy_monotonic(pid, p, band_ids)


def _validate_factor(f: dict[str, Any]) -> None:
    fid = f.get("id")
    if f["type"] == "categorical":
        if "map" not in f or "default" not in f:
            raise ConfigError(f"factor {fid}: categorical needs map and default")
        return
    if f["type"] != "numeric" or f.get("direction") not in ("higher_is_better", "lower_is_better"):
        raise ConfigError(f"factor {fid}: bad type or direction")
    bins = f["bins"]
    if "lt" in bins[-1] or any("lt" not in b for b in bins[:-1]):
        raise ConfigError(f"factor {fid}: only the last bin may omit lt")
    thresholds = [b["lt"] for b in bins[:-1]]
    if thresholds != sorted(set(thresholds)):
        raise ConfigError(f"factor {fid}: lt thresholds must strictly increase")
    pts = [b["points"] for b in bins]
    if f["direction"] == "higher_is_better" and pts != sorted(pts):
        raise ConfigError(f"factor {fid}: points must not decrease as value grows")
    if f["direction"] == "lower_is_better" and pts != sorted(pts, reverse=True):
        raise ConfigError(f"factor {fid}: points must not increase as value grows")


def _check_policy_monotonic(pid: str, product: dict[str, Any], band_ids: list[str]) -> None:
    """Лучший уровень риска не может получить худшие условия, чем более слабый."""
    present = [b for b in band_ids if b in product["bands"]]
    for better, worse in zip(present, present[1:]):
        b, w = product["bands"][better], product["bands"][worse]
        if b["max_revenue_multiple"] < w["max_revenue_multiple"] or b["max_amount"] < w["max_amount"] \
                or b["max_term_months"] < w["max_term_months"] or b["annual_rate"] > w["annual_rate"]:
            raise ConfigError(f"product {pid}: band {better} has worse limits or rate than {worse}")
