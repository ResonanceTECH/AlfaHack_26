# Frontend endpoints

Эндпоинты API, которые дергает фронт. Базовый префикс: `/api/v1` (прокси Vite → backend).

Экраны: **логин**, **забыли пароль**, **выбор / добавление компании**, **главная**, **профиль компании**, **финансовый профиль**, **календарь**, **профиль пользователя**, **команда**, **помощь**, **AI-консультант**, **админ** (обзор / аналитика / продукты / политика / пользователи / аудит / уведомления).

Клиентские экраны — с бэка (на главной заявки ещё подмешиваются из локального кэша после демо-отправки). Админ-каталог ниже = реальный `backend/app/api/v1/admin.py` (45 маршрутов). UI-экраны overview/analytics/notifications пока на локальной синтетике — бэкенд-эндпоинтов под них нет.

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

После успеха:
- `admin` → `/app/admin`
- `analyst` → `/app/manager` (если есть)
- предприниматель с `companyId` → `/app`
- иначе → `/select-company`

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

Код: `CompanyPage.tsx` · макет (реквизиты / владельцы / счета / контакты + сайдбар) · `useAppStore()` + `api/companies.ts`.

| Method | Path | Когда |
|--------|------|--------|
| `GET` | `/companies/{companyId}` | Mount через store |
| `GET` | `/companies` | блок «Мои компании» |
| `PATCH` | `/companies/{companyId}` | «Редактировать» → сохранить |
| `POST` | `/companies/{companyId}/registry/verify` | подтверждение на `/app/company/inn-check` |

Владельцы / согласия — UI demo поверх реальных реквизитов.  
Вкладка «Банковские счета»: empty без счёта; «+ Добавить счёт» → модалка реквизитов → localStorage `alfa_company_bank_accounts:{id}` (JSON); «Загрузить выписку» → `/app/statements/upload`; история — по `transactions`. Полнота 4/6 без счёта, 5/6 без выписки.

«Проверить ИНН» → `/app/company/inn-check` (`CompanyInnCheckPage.tsx`):

| Method | Path | Когда |
|--------|------|--------|
| `POST` | `/registry/companies/lookup` | «Проверить» |
| `POST` | `/companies/{id}/registry/verify` | «Подтвердить и продолжить» |

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

## Финансовый профиль — `/app/statements`

Код: `StatementsPage.tsx` · KPI/графики из `financials` + демо-ряд 12 мес.

| Method | Path | Когда |
|--------|------|--------|
| `GET` | `/companies/{id}/financials` | Mount (store) — масштаб KPI |
| `GET` | `/companies/{id}/transactions` | (store) после импорта |
| `POST` | `/statements/import` (multipart) | загрузка на `/app/statements/upload` |

«Загрузить выписку» → `/app/statements/upload` (`StatementUploadPage.tsx`).  
«Запустить анализ» → `/app/statements/analysis` (`StatementAnalysisPage.tsx`, KPI/графики из `financials` + демо).  
«Обновить данные» — `refetchAll()` store.

---

## Подбор кредита — `/app/recommendations`

| Route | Код | Шаг |
|-------|-----|-----|
| `/app/recommendations` | `SelectionGoalPage.tsx` | Цель + параметры |
| `/app/recommendations/budget` | `SelectionBudgetPage.tsx` | Статьи + слайдеры |
| `/app/recommendations/results` | `SelectionResultsPage.tsx` | Фильтры + карточки |

Draft: localStorage `alfa_selection_draft:{companyId}` (`features/selection/`).  
Степпер: Цель → Бюджет → Подбор → Сравнение → Заявка.

| Method | Path | Когда |
|--------|------|--------|
| `POST` | `/companies/{id}/funding-needs` | «Продолжить к бюджету» |
| `POST` | `/credit/recommendations` | результаты (fallback — демо-продукты) |

«Сравнить (N)» (N≥2) → `/app/compare` (`ComparePage.tsx`: таблица, diff-toggle, скачать TSV).  
«Выбрать» → `/app/applications/new` (`ApplicationWizardPage`): карточка продукта, готовность, чекбокс, «Отправить заявку» → `POST` applications + submit (или демо-редирект).  
Демо-продукты: `features/selection/demoProducts.ts`.

---

## AI-консультант — `/app/ai`

Код: `AiChatPage.tsx` · `POST /ai/chat` (`api/statements.ts` → `aiChat`).

| Method | Path | Когда |
|--------|------|--------|
| `POST` | `/ai/chat` | Отправка сообщения / быстрый вопрос |
| store | company / financials / goals / apps | блок «Контекст, который учитывает AI» |

```json
{ "companyId": "company_001", "message": "…", "conversationId": null }
```

Стартовый диалог в UI — демо-тред (как в макете); дальше — ответы бэка. При ошибке сети — локальный fallback.  
«+ Новый диалог» — пустой тред (welcome) + новый `conversationId` на первом сообщении; список тредов в localStorage `alfa_ai_threads:{companyId}`.

---

## Главная — `/app`

Код: `DashboardPage.tsx` · `useAppStore()` + `api/applications.ts` · `api/credit.ts` (readiness).

| Method | Path | Блок UI |
|--------|------|---------|
| `GET` | `/applications?companyId=` | «Мои заявки» + карточка активной заявки |
| `GET` | `/applications/{id}` | переход «Посмотреть условия» / «Трекер» |
| `POST` | `/applications` | новая заявка (`ApplicationWizardPage`) |
| `POST` | `/applications/{id}/submit` | отправка черновика → статус `submitted` |
| `POST` | `/credit/readiness` | «Профиль заполнен на N%» (пустая активная карточка) |
| `GET` | `/companies` | чипы компаний в шапке |
| `GET` | `/companies/{companyId}/financials` | плитка финансов |
| `GET` | `/obligations?companyId=` | «Ближайшие задачи» |

### Активная заявка

`pickActiveApp`: первый из `submitted` / `in_review` / `docs_requested` / `approved`, иначе `draft`, иначе любая.

Поля карточки: `amount`, `termMonths`, `rate`, `purpose` / `productName`, `status` → пайплайн этапов.

### `GET /applications?companyId=`

```json
[
  {
    "id": "ABC-2026-1042",
    "companyId": "company_001",
    "productId": "prod_turnover",
    "productName": "Бизнес-Оборот",
    "status": "in_review",
    "amount": 5000000,
    "termMonths": 24,
    "rate": 17.9,
    "purpose": "Пополнение оборотных средств",
    "readinessScore": 78,
    "documents": [],
    "comments": [],
    "statusHistory": [{ "status": "submitted", "at": "2026-10-21T10:00:00Z", "by": "self" }],
    "createdAt": "2026-10-21T10:00:00Z",
    "updatedAt": "2026-10-23T09:15:00Z"
  }
]
```

Код: `listApplications(companyId)` → `useAppStore().apps`. На главной: `mergeApplications(api, localStorage)`.

### `POST /applications` + `POST /applications/{id}/submit`

Экран: `/app/applications/new`.

```json
{
  "companyId": "company_001",
  "productId": "prod_turnover",
  "amount": 5000000,
  "termMonths": 24,
  "rate": 17.9,
  "purpose": "…"
}
```

После успеха — invalidate `['applications']` → главная показывает заявку в «Мои заявки» и в блоке активной.

Если продукт только демо (нет id в API) — заявка пишется в `localStorage` (`alfa_local_applications`) тем же shape, чтобы главная всё равно отрисовала.

---

## Карточка заявки — `/app/applications/:id`

Код: `ApplicationDetailPage.tsx` · `api/applications.ts` · `features/applications/appDocuments.ts` · `localApps.ts`.

Одна страница кабинета: **условия + пайплайн + чек-лист документов + история**.  
Старый URL `/app/applications/:id/documents` редиректит сюда (`#documents`).

| Method | Path | Блок UI |
|--------|------|---------|
| `GET` | `/applications/{id}` | шапка, условия, статус, история, комментарии |
| `POST` | `/applications/{id}/documents` | загрузка файла в слот чек-листа (multipart) |
| `POST` | `/applications/{id}/submit` | после комплекта документов (wizard / следующий шаг) |
| `PATCH` | `/applications/{id}/status` | менеджер (не предприниматель) |

Fallback: если `GET` 404 — заявка из `alfa_local_applications`.  
Чек-лист слотов (выписка, паспорт, договор/КП, УСН, БКИ, залог) — `localStorage` `alfa_app_documents:{applicationId}`; при успешном `POST …/documents` ещё invalidate `['application']` / `['applications']`.

### `GET /applications/{id}`

```json
{
  "id": "39a6437e-2ebf-4e50-b7b8-8bf20bef01c3",
  "companyId": "company_001",
  "productId": "prod_invest",
  "productName": "Инвестиционный кредит «Рост»",
  "status": "in_review",
  "amount": 14200000,
  "termMonths": 48,
  "rate": 18.75,
  "purpose": "Закупка оборудования",
  "readinessScore": 75,
  "documents": [
    {
      "id": "doc_1",
      "type": "statement",
      "name": "выписка_40702.pdf",
      "size": 2400000,
      "uploadedAt": "2026-10-25T15:42:00Z",
      "status": "uploaded"
    }
  ],
  "comments": [],
  "statusHistory": [
    { "status": "submitted", "at": "2026-10-24T10:00:00Z", "by": "self" },
    { "status": "in_review", "at": "2026-10-25T09:00:00Z", "by": "manager" }
  ],
  "createdAt": "2026-10-24T10:00:00Z",
  "updatedAt": "2026-10-25T15:42:00Z"
}
```

### `POST /applications/{id}/documents`

`multipart/form-data` · поле `file`.  
Код: `uploadApplicationDocument(id, file)`.  
UI: drag&drop / «Загрузить» / «Заменить» в блоке «Документы по заявке». Демо без бэка — только локальный чек-лист.

Кнопка «К проверке перед отправкой» активна, когда все **обязательные** слоты в статусе `uploaded` | `review`.

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

---

## Админ — каталог API (`/api/v1/admin/*`)

Источник правды: `backend/app/api/v1/admin.py` + схемы `backend/app/schemas/admin.py`.  
Все маршруты требуют роль `ADMIN` (+ permission из таблицы ниже). Фронт: gate `Protected roles={['admin']}`, layout `AppLayout` (`adminGroups`).

| Permission | Маршруты |
|------------|----------|
| (только ADMIN) | `GET /admin/roles`, `GET /admin/permissions` |
| `USERS_MANAGE` | users, companies, members |
| `CATALOG_MANAGE` | credit-products |
| `POLICY_EDIT` | policies (кроме publish) |
| `POLICY_PUBLISH` | `POST .../policies/{id}/publish` |
| `MODELS_MANAGE` | models, config/runtime |
| `DEMO_RESET` | demo/* |
| `AUDIT_READ` | audit/events |

### UI ↔ API

| Экран | Код | Что реально есть на бэке | UI сейчас |
|-------|-----|--------------------------|-----------|
| `/app/admin` | `AdminOverviewPage` | — | синтетика |
| `/app/admin/analytics` | `AdminAnalyticsPage` | — | синтетика |
| `/app/admin/products` | `AdminProductsPage` | `/admin/credit-products*` | синтетика |
| `/app/admin/policy` | `AdminPolicyPage` | `/admin/policies*` | синтетика |
| `/app/admin/users` | `AdminUsersPage` | `/admin/users*`, `/roles`, `/permissions`, `/companies*` | синтетика |
| `/app/admin/audit` | `AdminAuditPage` | `/admin/audit/events*` | синтетика |
| `/app/admin/notifications` | `AdminNotificationsPage` | общего `/notifications` для admin нет | локально |

---

## Админ · роли и permissions

| Method | Path | Ответ |
|--------|------|--------|
| `GET` | `/admin/roles` | `AdminRoleOut[]` |
| `GET` | `/admin/permissions` | `AdminPermissionOut[]` |

`AdminRoleOut`: `{ role, title, description, permissions[] }`  
`AdminPermissionOut`: `{ code, title }`

Роли системы: `ENTREPRENEUR` | `ANALYST` | `ADMIN`.

---

## Админ · пользователи — `/app/admin/users`

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/admin/users` | query: `role`, `status`, `q`, `limit` (1–100, def 50), `offset` |
| `POST` | `/admin/users` | 201 |
| `GET` | `/admin/users/{user_id}` | |
| `PATCH` | `/admin/users/{user_id}` | partial |
| `POST` | `/admin/users/{user_id}/disable` | status→DISABLED, revoke sessions |
| `POST` | `/admin/users/{user_id}/reset-credentials` | body `{ password }` |

### `AdminUserOut`

```json
{
  "id": "usr_…",
  "login": "admin",
  "email": null,
  "phone": null,
  "full_name": "Админ",
  "role": "ADMIN",
  "status": "ACTIVE",
  "is_active": true,
  "permissions": ["USERS_MANAGE", "AUDIT_READ"],
  "company_ids": [],
  "last_login_at": "2026-10-25T10:00:00Z",
  "created_at": "2026-01-01T00:00:00Z"
}
```

Список: `{ "items": [...], "total": N }`.

### `POST /admin/users`

```json
{
  "login": "ivan",
  "password": "secret12",
  "full_name": "Иван Иванов",
  "email": null,
  "phone": null,
  "role": "ENTREPRENEUR",
  "status": "ACTIVE"
}
```

### `PATCH /admin/users/{user_id}`

Любые из: `login`, `email`, `phone`, `full_name`, `role`, `status`, `is_active`.  
Нельзя снять с себя `ADMIN` / отключить себя через PATCH (409).

### `POST .../disable` → `AdminDisableOut`

```json
{ "user_id": "usr_…", "status": "DISABLED", "is_active": false, "sessions_revoked": 2 }
```

### `POST .../reset-credentials`

Body: `{ "password": "newpass1" }` → `{ "user_id", "message" }` (сессии отозваны).

---

## Админ · компании и members

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/admin/companies` | `q`, `limit`, `offset` → `{ items, total }` |
| `GET` | `/admin/companies/{company_id}/members` | `AdminMemberOut[]` |
| `PUT` | `/admin/companies/{company_id}/members/{user_id}` | upsert |
| `DELETE` | `/admin/companies/{company_id}/members/{user_id}` | 204 |

`AdminCompanyBrief`: `{ id, inn, name, legal_form, registry_status, region, members_count }`

`PUT` body: `{ "role": "MEMBER"|"OWNER"|…, "permissions": {} }`

---

## Админ · каталог продуктов — `/app/admin/products`

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/admin/credit-products` | `status`, `type`, `q`, `limit`, `offset` |
| `POST` | `/admin/credit-products` | 201 |
| `GET` | `/admin/credit-products/{product_id}` | + versions |
| `PATCH` | `/admin/credit-products/{product_id}` | draft fields |
| `POST` | `/admin/credit-products/{product_id}/publish` | body `{ changelog? }` |
| `POST` | `/admin/credit-products/{product_id}/archive` | |
| `GET` | `/admin/credit-products/{product_id}/versions` | `AdminCreditProductVersionOut[]` |

Список: `{ items: AdminCreditProductOut[], total }`.

Ключевые поля продукта: `code`, `name`, `type`, `amount_min/max`, `term_*`, `rate_*` / `annual_rate_percent`, `legal_forms`, `suitable_goals`, `status`, `version`, `is_active`, `rules[]`, `versions[]`.

Нет на бэке: `/admin/credit-products/import`.

---

## Админ · кредитная политика — `/app/admin/policy`

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/admin/policies` | `status`, `q`, `limit`, `offset` |
| `POST` | `/admin/policies` | 201 · `{ code, name, description?, rules }` |
| `GET` | `/admin/policies/{policy_id}` | + versions |
| `PATCH` | `/admin/policies/{policy_id}` | `{ code?, name?, description?, rules? }` |
| `GET` | `/admin/policies/{policy_id}/versions` | |
| `POST` | `/admin/policies/{policy_id}/validate` | → `{ valid, errors[], warnings[], allowed_keys[] }` |
| `POST` | `/admin/policies/{policy_id}/simulate` | 202 · body `{ draft_version?, scenario_ids?, compare_with_published? }` → `{ run_id, status }` |
| `GET` | `/admin/policies/{policy_id}/simulations/{run_id}` | результат прогона |
| `POST` | `/admin/policies/{policy_id}/publish` | `POLICY_PUBLISH` · `{ changelog? }` |
| `GET` | `/admin/policies/{policy_id}/diff` | query: `from`, `to` (версии) → added/removed/changed |

`AdminPolicyOut`: `{ id, code, name, description, status, version, rules, parameter_source, published_at, versions[] }`.

Старый путь `/admin/policy/versions…` в UI-доках — **не существует**. Рабочий ресурс — `/admin/policies`.

---

## Админ · ML-модели

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/admin/models` | query `task?` |
| `GET` | `/admin/models/active` | активные по task |
| `GET` | `/admin/models/evaluations` | все evals |
| `GET` | `/admin/models/{model_id}` | + evaluations |
| `POST` | `/admin/models/{model_id}/validate` | совместимость/health |
| `POST` | `/admin/models/{model_id}/activate` | `{ task, expected_model_version?, reason? }` |
| `GET` | `/admin/models/{model_id}/evaluations` | |

Отдельного экрана на фронте пока нет.

---

## Админ · runtime config

| Method | Path |
|--------|------|
| `GET` | `/admin/config/runtime` |
| `PATCH` | `/admin/config/runtime` |

Patch body: `{ "parameters": { … } }` → `{ parameters, whitelist, applied, rejected, note }`.

---

## Админ · demo

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/admin/demo/scenarios` | |
| `GET` | `/admin/demo/scenarios/{scenario_id}` | |
| `POST` | `/admin/demo/scenarios/{scenario_id}/load` | 202 → job |
| `POST` | `/admin/demo/reset` | 202 · `{ workspace, confirm_phrase, seed_version? }` |
| `GET` | `/admin/demo/jobs/{job_id}` | статус job |

---

## Админ · аудит — `/app/admin/audit`

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/admin/audit/events` | `action`, `entity_type`, `actor_id`, `q`, `limit` (≤200), `offset` |
| `GET` | `/admin/audit/events/{event_id}` | |

```json
{
  "items": [
    {
      "id": "aud_…",
      "actor_id": "usr_…",
      "actor_login": "admin",
      "actor_role": "ADMIN",
      "action": "admin_patch",
      "entity_type": "user",
      "entity_id": "usr_…",
      "company_id": null,
      "correlation_id": "…",
      "details": {},
      "created_at": "2026-10-25T10:00:00Z"
    }
  ],
  "total": 42
}
```

Секреты в `details` маскируются (`***`).  
Нет на бэке: `/admin/audit`, `/admin/audit/export`, `/admin/audit/verify`.

---

## Админ · UI-only (бэка нет)

Экраны ниже живут на синтетике. Этих маршрутов в `admin.py` **нет**:

| UI path | Выдуманный контракт (не реализовывать как есть) |
|---------|--------------------------------------------------|
| overview | `GET /admin/overview`, `POST /admin/reports/export`, `POST /admin/incidents` |
| analytics | `GET /admin/analytics/conveyor`, `…/export` |
| notifications | `GET /notifications?audience=admin`, `/admin/notification-prefs` |
| users (старый) | `…/block`, `…/unblock`, `/users/invite`, `/users/bulk`, `/users/export`, `/roles/permissions` |

Когда будете вешать HTTP — маппить на реальные пути выше (`disable` вместо `block`, `/admin/policies` вместо `/admin/policy/versions`, `/admin/audit/events` вместо `/admin/audit`).
