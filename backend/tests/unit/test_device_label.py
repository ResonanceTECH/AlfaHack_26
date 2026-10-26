from app.services.device_label import format_device_label


def test_curl():
    assert format_device_label("curl/8.7.1").startswith("API-клиент (curl")


def test_chrome_macos():
    ua = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36"
    )
    assert format_device_label(ua) == "Chrome · macOS"


def test_safari_iphone():
    ua = (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    )
    assert format_device_label(ua) == "Safari · iPhone"


def test_empty():
    assert format_device_label(None) == "Неизвестное устройство"
    assert format_device_label("") == "Неизвестное устройство"


def test_edge_windows():
    ua = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"
    )
    assert format_device_label(ua) == "Edge · Windows"
