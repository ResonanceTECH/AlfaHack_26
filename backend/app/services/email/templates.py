from __future__ import annotations

from app.config import get_settings


def _wrap_html(title: str, body_html: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><title>{title}</title></head>
<body style="font-family:Arial,sans-serif;color:#0B1F35;line-height:1.5">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <h1 style="color:#EF3124;font-size:20px;margin:0 0 16px">Линия решения</h1>
    {body_html}
    <p style="color:#6B7A8D;font-size:12px;margin-top:32px">
      Если вы не запрашивали это письмо, просто проигнорируйте его.
    </p>
  </div>
</body>
</html>"""


def verification_email(token: str, full_name: str) -> tuple[str, str, str]:
    settings = get_settings()
    link = f"{settings.frontend_url.rstrip('/')}/verify-email?token={token}"
    subject = "Подтвердите email — Линия решения"
    text = (
        f"Здравствуйте, {full_name}!\n\n"
        f"Подтвердите адрес электронной почты, перейдя по ссылке:\n{link}\n\n"
        "Ссылка действует ограниченное время и может быть использована один раз.\n"
    )
    html = _wrap_html(
        subject,
        f"<p>Здравствуйте, {full_name}!</p>"
        f"<p>Подтвердите адрес электронной почты:</p>"
        f'<p><a href="{link}" style="background:#EF3124;color:#fff;padding:12px 20px;'
        f'text-decoration:none;border-radius:8px;display:inline-block">Подтвердить email</a></p>'
        f'<p style="font-size:13px;color:#6B7A8D">Или откройте: {link}</p>',
    )
    return subject, text, html


def password_reset_email(token: str, full_name: str) -> tuple[str, str, str]:
    settings = get_settings()
    link = f"{settings.frontend_url.rstrip('/')}/reset-password?token={token}"
    subject = "Сброс пароля — Линия решения"
    text = (
        f"Здравствуйте, {full_name}!\n\n"
        f"Чтобы задать новый пароль, перейдите по ссылке:\n{link}\n\n"
        "Если вы не запрашивали сброс — проигнорируйте письмо.\n"
    )
    html = _wrap_html(
        subject,
        f"<p>Здравствуйте, {full_name}!</p>"
        f"<p>Запрос на сброс пароля:</p>"
        f'<p><a href="{link}" style="background:#EF3124;color:#fff;padding:12px 20px;'
        f'text-decoration:none;border-radius:8px;display:inline-block">Сбросить пароль</a></p>',
    )
    return subject, text, html


def contact_linked_email(full_name: str, contact_type: str, masked: str) -> tuple[str, str, str]:
    subject = "Привязан новый контакт — Линия решения"
    text = (
        f"Здравствуйте, {full_name}!\n\n"
        f"К вашему аккаунту привязан новый {contact_type}: {masked}.\n"
        "Если это были не вы — срочно смените пароль и обратитесь в поддержку.\n"
    )
    html = _wrap_html(
        subject,
        f"<p>Здравствуйте, {full_name}!</p>"
        f"<p>К аккаунту привязан новый {contact_type}: <strong>{masked}</strong>.</p>"
        "<p>Если это были не вы — смените пароль и обратитесь в поддержку.</p>",
    )
    return subject, text, html


def critical_change_email(full_name: str, change_description: str) -> tuple[str, str, str]:
    subject = "Изменение данных аккаунта — Линия решения"
    text = (
        f"Здравствуйте, {full_name}!\n\n"
        f"{change_description}\n\n"
        "Если это были не вы — срочно восстановите доступ.\n"
    )
    html = _wrap_html(
        subject,
        f"<p>Здравствуйте, {full_name}!</p><p>{change_description}</p>"
        "<p>Если это были не вы — срочно восстановите доступ.</p>",
    )
    return subject, text, html
