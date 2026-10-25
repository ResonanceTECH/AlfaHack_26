import copy

from credit_scoring.config import ConfigError, load_config, validate_config


def _raises(cfg):
    try:
        validate_config(cfg)
    except ConfigError:
        return True
    return False


def test_default_config_is_valid():
    cfg = load_config()
    assert cfg["version"] and set(cfg["products"]) == {"working_capital", "overdraft", "equipment", "express"}


def test_non_monotonic_factor_is_rejected():
    cfg = copy.deepcopy(load_config())
    cfg["factors"][0]["bins"][0]["points"] = 99  # молодой бизнес получил больше баллов, чем зрелый
    assert _raises(cfg)


def test_worse_band_with_better_terms_is_rejected():
    cfg = copy.deepcopy(load_config())
    cfg["products"]["express"]["bands"]["C"]["annual_rate"] = 0.10  # дешевле, чем у A
    assert _raises(cfg)


def test_lowest_band_cannot_have_policy():
    cfg = copy.deepcopy(load_config())
    cfg["products"]["express"]["bands"]["D"] = dict(cfg["products"]["express"]["bands"]["C"])
    assert _raises(cfg)
