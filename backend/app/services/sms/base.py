from __future__ import annotations

from abc import ABC, abstractmethod


class SmsDeliveryError(Exception):
    pass


class SmsProvider(ABC):
    @abstractmethod
    async def send_verification_code(self, phone: str, code: str) -> None:
        pass

    def send_verification_code_sync(self, phone: str, code: str) -> None:
        import asyncio
        import concurrent.futures

        try:
            asyncio.get_running_loop()
        except RuntimeError:
            asyncio.run(self.send_verification_code(phone, code))
            return

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            pool.submit(lambda: asyncio.run(self.send_verification_code(phone, code))).result()
