from __future__ import annotations

from abc import ABC, abstractmethod


class EmailDeliveryError(Exception):
    pass


class EmailProvider(ABC):
    @abstractmethod
    def send(
        self,
        *,
        to: str,
        subject: str,
        text_body: str,
        html_body: str | None = None,
    ) -> None:
        ...
