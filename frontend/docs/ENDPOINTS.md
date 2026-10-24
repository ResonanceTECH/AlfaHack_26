# Frontend endpoints

Эндпоинты API, которые дергает фронт. Базовый префикс: `/api/v1` (прокси Vite → backend).

Экраны: **логин**, **забыли пароль**, **выбор / добавление компании**.

Данные только с бэка — без mock UI и без `?empty=1`.

## Логин — `/login`

| Method | Path | Когда |
|--------|------|--------|
| `POST` | `/auth/login` | Сабмит формы |
| `POST` | `/auth/logout` | Выход (если есть refresh) |
| `GET` | `/auth/me` | Профиль после сессии |

**`POST /auth/login`**

```json
{ "login": "user@company.ru", "password": "••••••••" }
```

Ответ: `accessToken`, `refreshToken`, `user` → `localStorage`.

После успеха предприниматель → `/select-company`.

Код: `LoginPage.tsx` → `useAuth().login` → `api/auth.ts`.

---

## Забыли пароль — `/forgot-password`

| Method | Path | Когда |
|--------|------|--------|
| `POST` | `/auth/password/forgot` | «Отправить ссылку» |

```json
{ "email": "user@company.ru" }
```

| Method | Path | Экран |
|--------|------|--------|
| `POST` | `/auth/password/reset` | `/reset-password?token=…` |

Код: `ForgotPasswordPage.tsx` → `forgotPasswordRequest`.

---

## Выбор компании — `/select-company`

Код: `SelectCompanyPage.tsx` · клиент: `api/companies.ts` · `useAuth()` (`logout`, `selectCompany` — локально).

Два UI-состояния по ответу `GET /companies`:

| Состояние | Условие | UI |
|-----------|---------|-----|
| First visit | `companies.length === 0` | Добавление по ИНН (слева поиск, справа карточка / плейсхолдер) |
| Список | `companies.length > 0` | Карточки + «Подробнее» → превью справа → «Продолжить» |

| Method | Path | Когда |
|--------|------|--------|
| `GET` | `/companies` | Mount: список memberships |
| `POST` | `/registry/companies/lookup` | «Найти в реестре» |
| `POST` | `/companies` | «Подтвердить доступ» после lookup |
| `GET` | `/companies/{companyId}/dashboard` | «Подробнее» по уже добавленной компании |
| `POST` | `/auth/logout` | «Выйти из аккаунта» |

### `GET /companies`

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

Код: `listCompanies()`.

- `[]` → first-visit (lookup + confirm).
- непустой → список карточек (кнопка «Подробнее», не «Продолжить»).

### First visit — lookup + confirm

#### `POST /registry/companies/lookup`

```json
{ "inn": "770123456703" }
```

Ответ:

```json
{
  "found": true,
  "source": "SYNTHETIC_REGISTRY",
  "innValid": true,
  "checkedAt": "…",
  "company": {
    "inn": "770123456703",
    "legalForm": "IP",
    "name": "ИП Петров Иван Сергеевич",
    "registrationDate": "2019-03-15",
    "region": "Москва",
    "registryStatus": "ACTIVE",
    "ogrn": "304770100012345"
  }
}
```

UI справа «Подробнее о компании»:

| Поле UI | Источник |
|---------|----------|
| Название / Компания | `company.name` |
| ИНН | `company.inn` |
| ОГРНИП / ОГРН | `company.ogrn` (IP → ОГРНИП, OOO → ОГРН) |
| Регион | `company.region` |
| Статус в реестре | `company.registryStatus` (`ACTIVE` → «Действующий») |
| Роль после добавления | фиксировано «Владелец» (создаём membership OWNER) |

Ошибки UI: невалидный ИНН / не найдено / `LIQUIDATED`.

Код: `lookupCompanyByInn(inn)`.

ИНН из реестра бэка (seed / synthetic catalog): `770123456703` (ИП), `7709876545` (ООО), `7701234560` (ООО).

#### `POST /companies`

После «Подтвердить доступ» — тело из ответа lookup + дефолты:

```json
{
  "inn": "770123456703",
  "name": "ИП Петров Иван Сергеевич",
  "legalForm": "IP",
  "industry": "Не указано",
  "registrationDate": "2019-03-15",
  "region": "Москва",
  "employeesCount": 1,
  "ogrn": "304770100012345"
}
```

После успеха: invalidate `['companies']` → экран переключается на список (уже не empty).

Код: `createCompany(…)`.

### Список компаний — «Подробнее» + кабинет

#### `GET /companies/{companyId}/dashboard`

Только после клика «Подробнее» (не автооткрытие).

UI превью: name / region / `membershipRole` из list item; KPI — `applicationsActive` из dashboard.

Код: `getCompanyDashboard(companyId)`.

«Продолжить» в превью → `selectCompany(id)` + `navigate('/app')` (без HTTP).

### Локально (без HTTP)

| Действие | Что |
|----------|-----|
| `selectCompany(id)` | `alfa_active_company_id` + `user.companyId` |
| «Продолжить» | `selectCompany` + `/app` |
| «Очистить» (first visit) | сброс ИНН / found / error в state |
