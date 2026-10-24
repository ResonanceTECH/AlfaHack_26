# Frontend endpoints

Эндпоинты API, которые дергает фронт. Базовый префикс: `/api/v1` (прокси Vite → backend).

Пока задокументированы экраны **логин** и **забыли пароль**.

## Логин — `/login`

| Method | Path | Когда |
|--------|------|--------|
| `POST` | `/auth/login/email` | Сабмит формы (email + password) |
| `POST` | `/auth/logout` | Выход (если есть refresh-токен) |
| `GET` | `/auth/me` | Обновление профиля после сессии |

**`POST /auth/login/email`**

```json
{ "email": "user@company.ru", "password": "••••••••" }
```

Ответ: сессия (`accessToken`, `refreshToken`, `user`) — кладётся в `localStorage`.

Код: `src/pages/LoginPage.tsx` → `useAuth().login` → `src/api/auth.ts` (`loginEmailRequest`).

---

## Забыли пароль — `/forgot-password`

| Method | Path | Когда |
|--------|------|--------|
| `POST` | `/auth/password/forgot` | «Отправить ссылку» / «Отправить ещё раз» |

**`POST /auth/password/forgot`**

```json
{ "email": "user@company.ru" }
```

Ответ (примерно): `{ message, deliveryMode? }` — UI не светит, есть ли аккаунт.

Связанный экран (ссылка из письма, пока без отдельной доки):

| Method | Path | Экран |
|--------|------|--------|
| `POST` | `/auth/password/reset` | `/reset-password?token=…` |

Код: `src/pages/ForgotPasswordPage.tsx` → `forgotPasswordRequest` в `src/api/auth.ts`.
