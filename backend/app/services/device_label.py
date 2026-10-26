"""Human-readable device labels from User-Agent (for active sessions UI)."""

from __future__ import annotations


def format_device_label(ua: str | None) -> str:
    """Map raw User-Agent → short RU label for «Активные сеансы»."""
    if not ua or not str(ua).strip():
        return "Неизвестное устройство"

    s = str(ua).strip()
    low = s.lower()

    # CLI / automation — common from smoke curls against /auth/login
    if low.startswith("curl/") or "/curl" in low[:24]:
        ver = s.split("/", 1)[-1].split()[0] if "/" in s else ""
        return f"API-клиент (curl{f' {ver}' if ver else ''})"
    if "wget/" in low:
        return "API-клиент (wget)"
    if "python-requests" in low or low.startswith("python-urllib"):
        return "API-клиент (Python)"
    if "httpx/" in low:
        return "API-клиент (httpx)"
    if "postman" in low:
        return "Postman"
    if "insomnia" in low:
        return "Insomnia"
    if "okhttp" in low:
        return "Android-приложение"

    os_name: str | None = None
    if "iphone" in low:
        os_name = "iPhone"
    elif "ipad" in low:
        os_name = "iPad"
    elif "android" in low:
        os_name = "Android"
    elif "mac os x" in low or "macintosh" in low:
        os_name = "macOS"
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
        browser = "Яндекс.Браузер"
    elif "firefox/" in low or "fxios/" in low:
        browser = "Firefox"
    elif "crios/" in low or "chrome/" in low:
        browser = "Chrome"
    elif "safari/" in low and "chrome/" not in low and "crios/" not in low and "android" not in low:
        browser = "Safari"
    elif "samsungbrowser" in low:
        browser = "Samsung Internet"

    if browser and os_name:
        return f"{browser} · {os_name}"
    if browser:
        return browser
    if os_name:
        return os_name

    truncated = s[:56]
    return truncated + ("…" if len(s) > 56 else "")
