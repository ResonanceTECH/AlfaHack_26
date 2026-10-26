"""Human-readable device labels from User-Agent (for active sessions UI)."""

from __future__ import annotations

_CLI_MARKERS = (
    "curl/",
    "wget/",
    "python-requests",
    "python-urllib",
    "httpx/",
    "postman",
    "insomnia",
    "httpie/",
    "go-http-client",
    "java/",
)


def is_cli_user_agent(ua: str | None) -> bool:
    """Smoke/API clients — hide from «Активные сеансы»."""
    if not ua:
        return False
    low = str(ua).strip().lower()
    if not low:
        return False
    if low.startswith("curl/") or low.startswith("wget/"):
        return True
    return any(m in low for m in _CLI_MARKERS)


def format_device_label(ua: str | None) -> str:
    """Map raw User-Agent → short RU label, e.g. «Chrome на Mac»."""
    if not ua or not str(ua).strip():
        return "Неизвестное устройство"

    s = str(ua).strip()
    low = s.lower()

    if is_cli_user_agent(s):
        if "curl/" in low:
            return "Служебный вход (API)"
        if "postman" in low:
            return "Postman"
        if "insomnia" in low:
            return "Insomnia"
        return "Служебный вход (API)"

    if "okhttp" in low:
        return "Приложение · Android"

    os_name: str | None = None
    if "iphone" in low:
        os_name = "iPhone"
    elif "ipad" in low:
        os_name = "iPad"
    elif "android" in low:
        os_name = "Android"
    elif "mac os x" in low or "macintosh" in low:
        os_name = "Mac"
    elif "windows nt" in low or "windows" in low:
        os_name = "Windows"
    elif "cros" in low:
        os_name = "ChromeOS"
    elif "linux" in low or "x11" in low:
        os_name = "Linux"

    browser: str | None = None
    if "edg/" in low or "edgios/" in low or "edge/" in low:
        browser = "Edge"
    elif "opr/" in low or "opera" in low:
        browser = "Opera"
    elif "yabrowser" in low or "yowser" in low:
        browser = "Яндекс"
    elif "firefox/" in low or "fxios/" in low:
        browser = "Firefox"
    elif "crios/" in low or "chrome/" in low:
        browser = "Chrome"
    elif "safari/" in low and "chrome/" not in low and "crios/" not in low and "android" not in low:
        browser = "Safari"
    elif "samsungbrowser" in low:
        browser = "Samsung Internet"

    if browser and os_name:
        return f"{browser} на {os_name}"
    if browser:
        return browser
    if os_name:
        return os_name

    truncated = s[:56]
    return truncated + ("…" if len(s) > 56 else "")
