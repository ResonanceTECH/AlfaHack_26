from __future__ import annotations

from pydantic import ConfigDict
from pydantic.alias_generators import to_camel


def api_model_config(**kwargs) -> ConfigDict:
    return ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        **kwargs,
    )
