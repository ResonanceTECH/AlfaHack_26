# Frontend endpoints

Эндпоинты API, которые дергает фронт. Базовый префикс: `/api/v1` (прокси Vite → backend).

Задокументированы экраны: **логин**, **забыли пароль**, **выбор компании**.

## Логин — `/login`

| Method | Path | Когда |
|--------|------|--------|
| `POST` | `/auth/login` | Сабмит формы (login = email + password) |
| `POST` | `/auth/logout` | Выход (если есть refresh-токен) |
| `GET` | `/auth/me` | Обновление профиля после сессии |

**`POST /auth/login`**

```json
{ "login": "user@company.ru", "password": "••••••••" }
```

Ответ: сессия (`accessToken`, `refreshToken`, `user`) — кладётся в `localStorage`.

После успеха предприниматель → `/select-company`.

Код: `src/pages/LoginPage.tsx` → `useAuth().login` → `src/api/auth.ts` (`loginEmailRequest`).

> Drift fixed: раньше в доке был несуществующий `POST /auth/login/email` с `{ email }` — в коде `POST /auth/login` с `{ login }`.

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

---

## Выбор компании — `/select-company`

Экран: `src/pages/SelectCompanyPage.tsx`.  
Клиент: `src/api/companies.ts` + `useAuth()` (`logout`, `selectCompany` — локально, без HTTP).

| Method | Path | Когда |
|--------|------|--------|
| `GET` | `/companies` | Mount: список доступных компаний |
| `GET` | `/companies/{companyId}/dashboard` | Выбрана компания (превью справа) |
| `POST` | `/registry/companies/lookup` | «Найти» / «Найти в реестре» по ИНН |
| `POST` | `/companies` | «Подтвердить и добавить» / «Это моя компания» |
| `POST` | `/auth/logout` | «Выйти из аккаунта» (если есть refresh) |

### `GET /companies`

Список memberships текущего юзера.

Ответ (элемент):

```json
{
  "id": "company_001",
  "inn": "770123456703",
  "name": "ИП Петров Иван Сергеевич",
  "legalForm": "IP",
  "region": "Москва",
  "industry": "Розничная торговля",
  "registryStatus": "ACTIVE",
  "version": 1,
  "membershipRole": "OWNER"
}
```

Код: `listCompanies()` → карточки / empty-state.

Empty: `companies.length === 0` (или `?empty=1` для превью) → first-visit UI без dashboard.

### `GET /companies/{companyId}/dashboard`

Превью после «Подробнее»: компания / регион / роль из list item; KPI — `applicationsActive`.

Код: `getCompanyDashboard(companyId)`.

### `POST /registry/companies/lookup`

```json
{ "inn": "7707083893" }
```

Ответ (примерно):

```json
{
  "found": true,
  "source": "synthetic",
  "innValid": true,
  "checkedAt": "…",
  "company": {
    "inn": "7707083893",
    "legalForm": "OOO",
    "name": "ООО «…»",
    "registrationDate": "2021-04-15",
    "region": "Москва",
    "registryStatus": "ACTIVE",
    "ogrn": "1027700000123"
  }
}
```

UI: справа «Подробнее о компании» (ОГРН/ОГРНИП, регион, статус, роль) → «Подтвердить доступ»; warning если не найдено / ликвидирована / невалидный ИНН.

Код: `lookupCompanyByInn(inn)`.

### `POST /companies`

Создание после подтверждения lookup (поля с реестра + дефолты):

```json
{
  "inn": "7707083893",
  "name": "ООО «…»",
  "legalForm": "OOO",
  "industry": "Не указано",
  "registrationDate": "2021-04-15",
  "region": "Москва",
  "employeesCount": 1
}
```

После успеха: `selectCompany(id)` (localStorage `alfa_active_company_id`) → остаёмся на `/select-company` с обновлённым списком.

Код: `createCompany(…)`.

### Локально (без HTTP)

| Действие | Что |
|----------|-----|
| `selectCompany(id)` | Пишет `alfa_active_company_id` + патчит `user.companyId` |
| «Продолжить» / «Открыть» | `selectCompany` + `navigate('/app')` |

### Drift vs предыдущая дока

| Было | Стало |
|------|--------|
| Секции `/select-company` не было | Добавлена |
| `POST /auth/login/email` в секции логина | Исправлен на `POST /auth/login` |
