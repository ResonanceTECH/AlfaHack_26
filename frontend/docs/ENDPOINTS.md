# Frontend endpoints

Эндпоинты API, которые дергает фронт. Базовый префикс: `/api/v1` (прокси Vite → backend).

Экраны: **логин**, **забыли пароль**, **выбор / добавление компании**, **профиль компании**, **календарь**, **профиль пользователя**, **команда**, **помощь**.

Данные только с бэка — без mock UI и без `?empty=1`.

## Логин — `/login`

| Method | Path | Когда |
|--------|------|--------|
| `POST` | `/auth/login` | Сабмит формы |
| `POST` | `/auth/refresh` | Авто при 401 (axios interceptor в `api/client.ts`) |
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

---

## Профиль компании — `/app/company`

Код: `CompanyPage.tsx` · данные: `useAppStore()` + `api/companies.ts`.

| Method | Path | Когда |
|--------|------|--------|
| `GET` | `/companies/{companyId}` | Mount через `useAppStore` → форма «Компания» |
| `GET` | `/companies/{companyId}/financials` | Mount → блок финансов (404 → пустой снимок) |
| `PATCH` | `/companies/{companyId}` | «Сохранить компанию» |
| `PATCH` | `/companies/{companyId}/financials` | «Сохранить финансы» |

Ссылка «Загрузить выписку» → `/app/statements` (без HTTP на этой странице).

### `GET /companies/{companyId}`

```json
{
  "id": "company_001",
  "inn": "770123456703",
  "name": "ИП Петров Иван Сергеевич",
  "legalForm": "IP",
  "ogrn": "304770100012345",
  "industry": "Розничная торговля",
  "registrationDate": "2019-03-15",
  "region": "Москва",
  "employeesCount": 8,
  "registryStatus": "ACTIVE",
  "version": 1,
  "membershipRole": "OWNER"
}
```

Код: `getCompany(companyId)`.

ИНН в форме read-only; `legalForm` disabled.

### `PATCH /companies/{companyId}`

Тело (частичное):

```json
{
  "name": "…",
  "industry": "…",
  "region": "…",
  "employeesCount": 8
}
```

После успеха: invalidate `['company', companyId]`.

Код: `updateCompany(companyId, patch)`.

> На бэке в `CompanyUpdate` нет `ogrn` / `registrationDate` — UI может показывать поля, но патч уходит только по поддерживаемым ключам (как в `updateCompany`).

### `GET` / `PATCH /companies/{companyId}/financials`

KPI: выручка, расходы, остаток, обязательства, действующие кредиты, `period`.

PATCH:

```json
{
  "period": "2026-09",
  "avgMonthlyRevenue": 900000,
  "operatingExpenses": 650000,
  "cashBalance": 420000,
  "liabilities": 180000,
  "activeCredits": 150000,
  "source": "manual",
  "confirmed": true
}
```

Код: `getFinancials` / `updateFinancials` · invalidate `['financials', companyId]`.

---

## Финансовый календарь — `/app/calendar`

Код: `CalendarPage.tsx` · `useAppStore()` (obligations, financials, goal, apps) + `api/companies.ts`.

| Method | Path | Когда |
|--------|------|--------|
| `GET` | `/obligations?companyId=` | Mount через store → сетка / ближайшие |
| `POST` | `/obligations` | «Добавить событие» |
| `GET` | `/companies/{companyId}/financials` | Доля от выручки в блоке «Платежи за месяц» |
| `GET` | `/companies/{companyId}/funding-needs` | (store) цели / график кредита → события |
| `GET` | `/companies/{companyId}/applications` | (store) сроки по заявкам в «Ближайшие» |

Экспорт `.ics` — клиентский файл, без HTTP.

### `GET /obligations?companyId=`

Элемент:

```json
{
  "id": "ob_1",
  "companyId": "company_001",
  "type": "rent",
  "title": "Аренда склада",
  "amount": 120000,
  "dueDate": "2026-11-05",
  "recurring": true,
  "status": "planned"
}
```

Код: `listObligations(companyId)`.

Типы → цвет чипа в сетке: `tax` оранжевый, `loan` зелёный, остальное серый.

### `POST /obligations`

```json
{
  "companyId": "company_001",
  "type": "supplier",
  "title": "…",
  "amount": 50000,
  "dueDate": "2026-11-20",
  "recurring": false,
  "status": "planned"
}
```

Код: `createObligation(…)` · invalidate `['obligations', companyId]`.

### Производные события (без отдельных эндпоинтов)

| Источник | UI |
|----------|-----|
| `buildPaymentSchedule(goal)` | зелёные «Платёж …» в сетке / итог «По кредитам» |
| активные `apps` | «Загрузить документы» / «Ответ банку» в ближайших |

---

## Профиль пользователя — `/app/profile`

Код: `ProfilePage.tsx` · `useAuth()` + `GET /companies` (название компании в подзаголовке).

| Method | Path | Когда |
|--------|------|--------|
| `GET` | `/auth/me` | (сессия) ФИО / email / phone |
| `GET` | `/companies` | подзаголовок «владелец …» |
| `POST` | `/auth/logout` | «Выйти» / «Выйти на всех устройствах» |

**Нет на бэке (UI-only / localStorage):** сохранение ФИО/телефона/языка/должности, 2FA/биометрия-тогглы, список сеансов, «Завершить» сеанс, аватар.

«Сменить пароль» → `/forgot-password` (`POST /auth/password/forgot`).

«Сохранить» пишет обновлённый `user` в `localStorage` (`alfa_user`), без `PATCH /auth/me`.

---

## Команда компании — `/app/team`

Код: `TeamPage.tsx` · `GET /companies` (название в подзаголовке).

| Method | Path | Когда |
|--------|------|--------|
| `GET` | `/companies` | Mount: имя активной компании |

**Нет на бэке (UI demo):** список участников, фильтры, матрица ролей, приглашение по e-mail, «Отозвать доступ». Приглашение добавляет строку локально в state.

---

## Помощь и вопросы — `/app/help`

Код: `HelpPage.tsx`.

HTTP к бэку нет — FAQ, категории, документы и контакты менеджера — статический UI.

| UI | Поведение |
|----|-----------|
| «Найти» | клиентский фильтр FAQ |
| «Написать в чат» | переход на `/app/ai` |
| «Заказать звонок» | `tel:88000000000` |
| PDF-ссылки | UI-only (файлов нет) |
