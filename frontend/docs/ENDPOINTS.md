# Frontend endpoints

Эндпоинты API, которые дергает фронт. Базовый префикс: `/api/v1` (прокси Vite → backend).

Экраны: **логин / verify / reset**, **онбординг**, **выбор компании**, **главная**, **компания**, **цели**, **финпрофиль / выписки**, **подбор / сравнение / калькуляторы / сценарии**, **заявки (список + карточка + wizard)**, **документы**, **календарь**, **команда**, **профиль**, **помощь**, **уведомления**, **AI**, **аналитик**, **админ**.

Кабинет предпринимателя: live через `api/companies|applications|credit|statements|auth|notifications` + `useAppStore`. Выписки/прогноз/readiness/калькулятор/ROI/сравнение — live (fallback на local math если пусто). Документы-реестр и команда — ещё демо/local. Аналитик — live `/analyst/*` (`api/analyst.ts`) + `/notifications`. Админ — live `api/admin.ts` (users/products/policy/audit/overview KPIs); analytics charts и MFA — ещё частично синтетика.

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
- `analyst` / `manager` / `risk_analyst` → `/app/analyst`
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

## Подтверждение email — `/verify-email`

| Method | Path | Когда |
|--------|------|--------|
| `GET` | `/auth/email/verify?token=` | Открытие ссылки из письма |
| `POST` | `/auth/email/resend` | Повторная отправка (если есть в UI) |

Код: `VerifyEmailPage.tsx` → `verifyEmailToken` · `api/auth.ts`.

---

## Выбор компании — `/select-company`

Код: `SelectCompanyPage.tsx` · клиент: `api/companies.ts` · `useAuth()` (`logout`, `selectCompany` — локально).  
`?invite=` → `InviteAcceptPage.tsx`: `GET /companies`, `GET /companies/{id}` + accept в **localStorage** (отдельного invite API нет).

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
| `GET` | `/applications?companyId=` | (store) сроки по заявкам в «Ближайшие» |
| `PATCH` | `/obligations/{id}` | смена статуса / правка события (клиент есть: `updateObligation`; UI может не звать) |

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
| `PATCH` | `/transactions/{id}/category` | смена категории (клиент готов; UI analysis может не звать) |

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
| `GET` | `/credit/products` | каталог / сравнение (store) |
| `POST` | `/credit/readiness` | готовность перед заявкой |

«Сравнить (N)» (N≥2) → `/app/compare` (`ComparePage.tsx`: таблица, diff-toggle, скачать TSV).  
«Выбрать» → `/app/applications/new` (`ApplicationWizardPage`): карточка продукта, готовность, чекбокс, «Отправить заявку» → `POST` applications + submit (или демо-редирект).  
Демо-продукты: `features/selection/demoProducts.ts`.  
Бюджет (`/app/recommendations/budget`) — только draft + `financials` из store, без отдельного POST.

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

Блоки UI: **условия · пайплайн · решение/офферы · запросы документов банка · чек-лист · чат с банком · история**.  
`/app/applications/:id/documents` → редирект сюда (`#documents`).  
`/app/applications/:id/edit` — `ApplicationEditPage` (демо / hardcoded editable map, без PATCH заявки).

| Method | Path | Блок UI |
|--------|------|---------|
| `GET` | `/applications/{id}` | шапка, условия, статус, statusHistory |
| `GET` | `/companies/{companyId}/applications/{id}/decision` | публичное решение банка |
| `GET` | `/companies/{companyId}/applications/{id}/offers` | офферы / контрпредложение |
| `POST` | `/companies/{companyId}/applications/{id}/offers/{offerId}/accept` | «Принять» |
| `POST` | `/companies/{companyId}/applications/{id}/offers/{offerId}/decline` | «Отклонить» |
| `GET` | `/companies/{companyId}/applications/{id}/document-requests` | открытые запросы документов |
| `POST` | `/companies/{companyId}/applications/{id}/documents` | multipart: слот чек-листа **или** ответ на doc-request (`doc_type`, опц. `document_request_id`) |
| `POST` | `/companies/{companyId}/applications/{id}/document-requests/{requestId}/respond` | явный respond (клиент: `respondDocumentRequest`; UI сейчас чаще грузит файл с `document_request_id`) |
| `GET` | `/companies/{companyId}/applications/{id}/comments` | чат (poll ~15s) |
| `POST` | `/companies/{companyId}/applications/{id}/comments` | сообщение предпринимателя банку |
| `POST` | `/applications/{id}/documents` | legacy upload без company scope |
| `POST` | `/applications/{id}/submit` | отправка после комплекта (wizard) |

Fallback: `GET` 404 → `alfa_local_applications`.  
Чек-лист слотов — `localStorage` `alfa_app_documents:{applicationId}` + invalidate `['application']` / `['applications']`.

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

### Decision / offers

**`GET …/decision`** — тип решения, explanation, статус.  
**`GET …/offers`** — сумма / срок / ставка / `offerVersion` / status.  
**`POST …/offers/{id}/accept`**

```json
{ "offerVersion": 1, "acceptedTerms": true }
```

**`POST …/offers/{id}/decline`**

```json
{ "reason": "Отклонено клиентом" }
```

Код: `fetchApplicationDecision` · `fetchApplicationOffers` · `acceptApplicationOffer` · `declineApplicationOffer`.

### Document requests (клиент)

**`GET …/document-requests`** — список открытых запросов аналитика.  
**`POST …/documents`** (multipart): `file`, `doc_type`, опционально `document_request_id`.  
**`POST …/document-requests/{requestId}/respond`**

```json
{ "documentIds": ["…"], "comment": "…" }
```

### Comments (чат с банком)

**`GET …/comments`** · **`POST …/comments`** `{ "text": "…" }` — только публичные; `is_internal` на стороне банка.

### Legacy upload

`POST /applications/{id}/documents` · `multipart` поле `file` · `uploadApplicationDocument`.  
UI: drag&drop / «Загрузить» / «Заменить». Без companyId — локальный чек-лист.

---

## Онбординг — `/onboarding/*`

Код: `CompanyCreatePage` · `OnboardingFinancesPage` · `OnboardingConfirmPage` · `api/companies.ts` · `api/statements.ts`.

| Method | Path | Экран |
|--------|------|--------|
| `POST` | `/companies` | `/onboarding/company` — создать / подтвердить |
| `GET` | `/companies/{id}` | company + confirm |
| `PATCH` | `/companies/{id}` | правки на шаге компании |
| `GET` | `/companies/{id}/financials` | finances + confirm |
| `PATCH` | `/companies/{id}/financials` | ручной ввод / подтверждение |
| `POST` | `/statements/import` | загрузка выписки на finances |
| `GET` | `/companies/{id}/funding-needs` | цели на confirm (`listGoals`) |

После confirm → `/app`.

---

## Список заявок — `/app/applications`

Код: `ApplicationsPage.tsx` · данные из `useAppStore().apps`.

| Method | Path | Когда |
|--------|------|--------|
| `GET` | `/applications?companyId=` | Mount (store) |
| `POST` | `/applications` | «Новая заявка» → wizard |
| `POST` | `/applications/{id}/submit` | из wizard |

Фильтры/карточки — клиент. Демо-заявки из `alfa_local_applications` мержатся на главной/списке.

Wizard: `/app/applications/new` · `ApplicationWizardPage` · create + submit (+ `POST /credit/readiness` при необходимости).

---

## Цель бизнеса — `/app/goals`

Код: `BusinessGoalPage.tsx` · также шаг `/app/recommendations`.

| Method | Path | Когда |
|--------|------|--------|
| `GET` | `/companies/{id}/funding-needs` | store / онбординг confirm |
| `POST` | `/companies/{id}/funding-needs` | сохранить цель |

```json
{
  "goalType": "equipment",
  "title": "…",
  "costs": { "equipment": 5000000 },
  "reserve": 0,
  "ownFunds": 1000000,
  "otherFunding": 0,
  "targetDate": "2026-12-01",
  "termMonths": 36
}
```

---

## Сценарии и калькуляторы

| Route | Код | API сейчас |
|-------|-----|------------|
| `/app/scenarios` | `ScenarioLabPage` | хаб-ссылки; store тянет `GET /credit/scenarios` |
| `/app/forecast` | `ForecastPage` | UI-local; клиент готов: `POST /forecasts/cashflow` |
| `/app/roi` | `RoiPage` | UI-local + handoff в localStorage |
| `/app/calculator` | `CalculatorPage` | UI-local + handoff |
| `/app/readiness` | `ReadinessPage` | UI; API: `POST /credit/readiness` (ещё с главной/wizard) |
| `/app/compare` | `ComparePage` | продукты из store `GET /credit/products` (+ демо fallback) |

### Credit catalog / scenarios (store + подбор)

| Method | Path | Когда |
|--------|------|--------|
| `GET` | `/credit/products` | store · сравнение · подбор |
| `GET` | `/credit/products/{productId}` | карточка продукта (клиент есть) |
| `POST` | `/credit/recommendations` | `/app/recommendations/results` |
| `POST` | `/credit/readiness` | готовность / главная |
| `GET` | `/credit/scenarios?company_id=` | store |
| `POST` | `/credit/scenarios` | сохранить сценарий (`saveScenario`; UI lab может не звать) |

### Forecast (клиент готов)

| Method | Path | Body |
|--------|------|------|
| `POST` | `/forecasts/cashflow` | `{ "companyId", "horizonDays": 30\|90\|180 }` |

Код: `fetchForecast` · `api/statements.ts`. Экран `/app/forecast` пока считает локально.

### Transactions (финпрофиль)

| Method | Path | Когда |
|--------|------|--------|
| `GET` | `/companies/{id}/transactions` | store после импорта |
| `PATCH` | `/transactions/{id}/category` | смена категории (`updateTransactionCategory`; UI может не звать) |
| `POST` | `/statements/import` | upload / onboarding finances |

---

## Документы компании — `/app/documents`

Код: `DocumentsPage.tsx` · `DocumentViewPage.tsx`.

**Нет HTTP** — демо-список / превью. Живые документы заявки — на `/app/applications/:id` (см. выше).

Опционально (есть в analyst company-scope, предприниматель может понадобиться для превью):

| Method | Path | Назначение |
|--------|------|------------|
| `GET` | `/companies/{companyId}/applications/{applicationId}/documents` | список |
| `GET` | `/companies/{companyId}/applications/{applicationId}/documents/{documentId}` | мета |
| `GET` | `/companies/{companyId}/applications/{applicationId}/documents/{documentId}/download` | файл |

---

## Уведомления предпринимателя — `/app/notifications`

Код: `NotificationsPage.tsx` (ветка entrepreneur).

**Нет live API** — локальный список. Для полного продукта:

| Method | Path | Когда |
|--------|------|--------|
| `GET` | `/notifications` | список |
| `PATCH` | `/notifications/{id}/read` | прочитано |
| `POST` | `/notifications/read-all` | всё прочитано |

(точные пути — по бэкенд-контракту; UI пока синтетика.)

---

## Роли предпринимателя vs бухгалтер

Один route-tree `/app/*`. Меню (`AppLayout`):

- **entrepreneur** — полный `entrepreneurGroups`
- **accountant** — урезанное меню: главная, компания, финпрофиль, календарь, помощь (deep-link на остальные экраны всё равно работает)

Company switcher в хедере: `GET /companies`.

---

## Store hydration — `useAppStore` (почти все экраны `/app`)

При `user.companyId` фронт параллельно дергает:

| Method | Path |
|--------|------|
| `GET` | `/companies/{companyId}` |
| `GET` | `/companies/{companyId}/financials` |
| `GET` | `/companies/{companyId}/funding-needs` |
| `GET` | `/applications?companyId=` |
| `GET` | `/obligations?companyId=` |
| `GET` | `/companies/{companyId}/transactions` |
| `GET` | `/credit/scenarios?company_id=` |
| `GET` | `/credit/products` |

Код: `hooks/useAppStore.ts`.

### Чеклист: все пути из `api/{auth,companies,applications,credit,statements}.ts` для кабинета бизнеса

| Status | Method | Path |
|--------|--------|------|
| wired | `POST` | `/auth/login` |
| wired | `POST` | `/auth/refresh` |
| wired | `POST` | `/auth/logout` |
| wired | `GET` | `/auth/me` |
| wired | `GET` | `/auth/email/verify` |
| client | `POST` | `/auth/email/resend` |
| wired | `POST` | `/auth/password/forgot` |
| wired | `POST` | `/auth/password/reset` |
| wired | `GET` | `/companies` |
| wired | `POST` | `/companies` |
| wired | `GET` | `/companies/{id}` |
| wired | `PATCH` | `/companies/{id}` |
| wired | `GET` | `/companies/{id}/dashboard` |
| wired | `POST` | `/companies/{id}/registry/verify` |
| wired | `POST` | `/registry/companies/lookup` |
| wired | `GET`/`PATCH` | `/companies/{id}/financials` |
| wired | `GET`/`POST` | `/companies/{id}/funding-needs` |
| wired | `GET`/`POST` | `/obligations` (+ `PATCH /obligations/{id}` client) |
| wired | `GET` | `/companies/{id}/transactions` |
| wired | `POST` | `/statements/import` |
| client | `PATCH` | `/transactions/{id}/category` |
| client | `POST` | `/forecasts/cashflow` |
| wired | `POST` | `/ai/chat` |
| wired | `GET` | `/credit/products` |
| client | `GET` | `/credit/products/{id}` |
| wired | `POST` | `/credit/recommendations` |
| wired | `POST` | `/credit/readiness` |
| wired | `GET` | `/credit/scenarios` |
| client | `POST` | `/credit/scenarios` |
| wired | `GET`/`POST` | `/applications` |
| wired | `GET` | `/applications/{id}` |
| wired | `POST` | `/applications/{id}/submit` |
| wired | `POST` | `/applications/{id}/documents` |
| wired | `GET` | `/companies/{cid}/applications/{id}/decision` |
| wired | `GET`/`POST accept\|decline` | `…/offers[/{offerId}/…]` |
| wired | `GET` | `…/document-requests` |
| client | `POST` | `…/document-requests/{id}/respond` |
| wired | `POST` | `…/documents` (company multipart) |
| wired | `GET`/`POST` | `…/comments` |
| not entrepreneur | `PATCH` | `/applications/{id}/status` → analyst legacy |
| not entrepreneur | `POST` | `/applications/{id}/request-documents` → analyst legacy |
| not entrepreneur | `GET` | `/manager/applications` → bank roles |

**Нет в клиенте (продуктовые дыры UI):** team invite/members API, notifications list/read, vault `/app/documents`, `GET …/documents` + download (опц. выше).

### Есть в `api/*`, UI предпринимателя пока не зовёт

| Method | Path | Клиент |
|--------|------|--------|
| `POST` | `/auth/email/resend` | `resendEmailVerification` |
| `PATCH` | `/transactions/{id}/category` | `updateTransactionCategory` |
| `POST` | `/forecasts/cashflow` | `fetchForecast` (`/app/forecast` считает локально) |
| `GET` | `/credit/products/{id}` | `getProduct` |
| `POST` | `/credit/scenarios` | `saveScenario` |
| `PATCH` | `/obligations/{id}` | `updateObligation` |
| `POST` | `…/document-requests/{id}/respond` | `respondDocumentRequest` (деталь грузит файл с `document_request_id`) |

---

## Команда — доп. экраны

| Route | API |
|-------|-----|
| `/app/team` | `GET /companies` (+ demo members) |
| `/app/team/invite`, `/app/team/tasks`, `/app/team/:memberId` | UI demo / local |
| Invite accept (если включён) | `GET /companies`, `GET /companies/{id}` |

Полный продукт (ещё не wired): invites/members под `/admin/companies/…/members` или company-scoped team API.

---

## Аналитик — кабинет (`/app/analyst/*`)

Источник правды API: `backend/app/api/v1/analyst.py` + схемы `backend/app/schemas/analyst.py`.  
Роль: `ANALYST` (`require_roles`). Фронт: `Protected roles={['analyst','manager','risk_analyst']}`, меню `AppLayout` → `buildAnalystGroups`, страницы `pages/analyst/*`, shell кейса `components/analyst/AnalystCaseShell.tsx`.

Legacy URL `/app/manager` → redirect `/app/analyst`.

**Сейчас UI:** live через `api/analyst.ts` → `/api/v1/analyst/*`. Route param — UUID (`resolveAnalystApplicationId` умеет искать по `applicationNumber` через queue `q`). Демо: Risks / Explain; AI-помощник локальный, чат с клиентом — live comments.

Shell всех вкладок кейса: `GET /analyst/applications/{id}` (`AnalystCaseShell` → outlet `card`).  
Layout sidebar: `GET /analyst/applications?assigned_to_me=true&limit=1` (last case hint).

### UI ↔ API (по экранам)

| Экран | Код | Эндпоинты | UI |
|-------|-----|-----------|-----|
| `/app/analyst` | `AnalystQueuePage` | `GET /analyst/applications` (`status`, `q`, `limit`) | live |
| `/app/analyst/mine` | `AnalystMinePage` | `GET …?assigned_to_me=true` | live |
| `/app/analyst/attention` | `AnalystAttentionPage` | `GET …?assigned_to_me=true` → клиентский фильтр SLA/docs | live derived |
| `/app/analyst/workflow` | `AnalystWorkflowPage` | `GET …?include_closed=true&limit=100` → `countsByStatus` | live derived |
| `/app/analyst/cases/:id` | `AnalystCaseOverviewPage` | card + `POST …/assign` («Взять в работу») | live |
| `…/company` | `AnalystCaseCompanyPage` | card.`company` | live |
| `…/finance` | `AnalystCaseFinancePage` | card.`financials` | live (+ клиентский chart) |
| `…/documents` | `AnalystCaseDocumentsPage` | card docs + `openDocumentRequests`; `POST …/document-requests` | live |
| `…/checks` | `AnalystCaseChecksPage` | `GET …/checks` | live |
| `…/risks` | `AnalystCaseRisksPage` | — (отдельного API нет) | демо |
| `…/explainability` | `AnalystCaseExplainPage` | — (можно брать `decisions`/`checks` из card) | демо |
| `…/ai` | `AnalystCaseAiPage` | `GET`/`POST …/comments` (`isInternal`); вкладка AI — local | live chat + local AI |
| `…/decision` | `AnalystCaseDecisionPage` | card (`allowedActions`, offers, gate) + `POST …/propose` | live |
| `…/history` | `AnalystCaseHistoryPage` | card.`statusHistory` + `application.comments` + `decisions` | live (из card) |
| `/app/notifications` | `NotificationsPage` | целевой `/notifications*` | синтетика |
| `/app/help` | `HelpPage` | — | статика (ветка analyst) |
| `/app/profile` | `ProfilePage` | `GET /auth/me`, `POST /auth/logout`, `GET /companies` | как у всех |

### Каталог `/analyst/*` (бэкенд `analyst.py` + фронт `api/analyst.ts`)

| Method | Path | Назначение | Фронт |
|--------|------|------------|-------|
| `GET` | `/analyst/applications` | Очередь / мои / поиск / SLA-агрегаты | wired |
| `GET` | `/analyst/applications/{id}` | Карточка (app+company+financials+workflow+checksSummary+openDocReqs+decisions+offers+allowedActions+statusHistory) | wired |
| `POST` | `/analyst/applications/{id}/assign` | Взять в работу | wired |
| `GET` | `/analyst/applications/{id}/checks` | Автопроверки | wired |
| `GET` | `/analyst/applications/{id}/document-requests` | Список запросов | на бэке есть; UI берёт `openDocumentRequests` из card |
| `POST` | `/analyst/applications/{id}/document-requests` | Запросить документ (201) | wired |
| `POST` | `/analyst/applications/{id}/document-requests/{request_id}/cancel` | Отменить запрос | на бэке есть; UI не зовёт |
| `GET` | `/analyst/applications/{id}/comments` | Чат / внутренние заметки | wired |
| `POST` | `/analyst/applications/{id}/comments` | Сообщение (`isInternal`) | wired |
| `POST` | `/analyst/applications/{id}/propose` | Решение / контр / NEED_INFO | wired |

### Связанные company-scoped (документы, статус)

Нужен `company_id` из карточки (`application.companyId` / `company.id`):

| Method | Path | Экран |
|--------|------|--------|
| `GET` | `/companies/{company_id}/applications/{application_id}/documents` | Документы |
| `GET` | `/companies/{company_id}/applications/{application_id}/documents/{document_id}` | Превью мета |
| `GET` | `/companies/{company_id}/applications/{application_id}/documents/{document_id}/download` | Скачать / превью |
| `GET` | `/companies/{company_id}/applications/{application_id}/status` | SLA / статус в шапке |
| `GET` | `/companies/{company_id}/applications/{application_id}/decision` | Публичное решение (если есть) |
| `GET` | `/companies/{company_id}/applications/{application_id}/offers` | Офферы в решении |
| `PATCH` | `/applications/{application_id}/status` | Legacy смена статуса (роль ANALYST) |
| `POST` | `/applications/{application_id}/request-documents` | Legacy запрос доков |

### `GET /analyst/applications` — очередь / мои

Query:

| Param | Тип | Default | Notes |
|-------|-----|---------|--------|
| `status` | `ApplicationStatus` | — | фильтр |
| `product_id` | string | — | |
| `assigned_to_me` | bool | `false` | экран «Мои заявки» |
| `unassigned` | bool | `false` | свободные в очереди |
| `q` | string | — | поиск name/ИНН/продукт/id |
| `include_closed` | bool | `false` | `REJECTED` / `ISSUED` |
| `limit` | 1–100 | 50 | |
| `offset` | ≥0 | 0 | |

```json
{
  "items": [
    {
      "id": "app_…",
      "applicationNumber": "ABC-2026-1042",
      "companyId": "company_001",
      "companyName": "ООО «Кофе Плюс»",
      "inn": "7701234567",
      "status": "IN_REVIEW",
      "currentStep": "docs_review",
      "productId": "prod_turnover",
      "productName": "Оборотный кредит",
      "amount": 1500000,
      "termMonths": 24,
      "rate": 17.9,
      "readinessScore": 72,
      "assignedAnalystId": "user_analyst_01",
      "assignedAnalystName": "Иванова А.С.",
      "openDocumentRequests": 1,
      "submittedAt": "2026-10-24T15:55:00Z",
      "updatedAt": "2026-10-25T14:12:00Z",
      "createdAt": "2026-10-24T15:50:00Z"
    }
  ],
  "total": 7,
  "countsByStatus": { "IN_REVIEW": 2, "DOCS_REQUESTED": 1 }
}
```

UI-маппинг:
- `/app/analyst` → без `assigned_to_me` (или `unassigned=true` для «взять в работу»)
- `/app/analyst/mine` → `assigned_to_me=true`

### `GET /analyst/applications/{id}` — карточка

Ответ `AnalystApplicationCard`:

```json
{
  "application": { "id": "app_…", "status": "IN_REVIEW", "amount": 1500000 },
  "company": {
    "id": "company_001",
    "inn": "7701234567",
    "name": "ООО «Кофе Плюс»",
    "legalForm": "OOO",
    "ogrn": "1197746123456",
    "industry": "Рестораны и кафе",
    "registrationDate": "2019-03-14",
    "region": "Москва",
    "employeesCount": 12,
    "registryStatus": "ACTIVE",
    "version": 1
  },
  "financials": {
    "id": "fin_…",
    "companyId": "company_001",
    "period": "2026-H1",
    "avgMonthlyRevenue": 4800000,
    "operatingExpenses": 4100000,
    "cashBalance": 920000,
    "liabilities": 860000,
    "activeCredits": 0,
    "source": "statement",
    "confirmed": true,
    "currency": "RUB"
  },
  "workflow": {
    "id": "wf_…",
    "workflowType": "credit_review",
    "status": "RUNNING",
    "currentStep": "docs_review"
  },
  "checksSummary": {
    "total": 9,
    "passed": 8,
    "failed": 0,
    "warnings": 1,
    "byStatus": {},
    "byAudience": {},
    "internalCount": 0
  },
  "openDocumentRequests": [],
  "decisions": [],
  "offers": [],
  "allowedActions": ["request_documents", "propose", "continue_checks"]
}
```

Экраны: **Обзор** (summary + `allowedActions` → контекстная панель), **Компания**, **Финансы** (KPI из `financials`).

### `GET /analyst/applications/{id}/checks`

```json
{
  "applicationId": "app_…",
  "status": "IN_REVIEW",
  "summary": { "total": 9, "passed": 8, "failed": 0, "warnings": 1 },
  "checks": [
    {
      "id": "chk_…",
      "checkKey": "cash_gap_days",
      "status": "WARN",
      "score": 70,
      "reasonCodes": ["CASH_GAP_AUG"],
      "explanation": "2 эпизода в августе",
      "audience": "analyst",
      "payload": {}
    }
  ]
}
```

Экраны: **Проверки**; драйверы для **Риски** / **Объяснимость** — из `checks` + `decisions[].explanation` / `reasonCodes` (отдельных `/risks`, `/explainability` нет).

### `POST /analyst/applications/{id}/assign`

Тело пустое. Назначает текущего аналитика, при необходимости → `IN_REVIEW`.  
Ответ бэка: `AnalystApplicationCard` (фронт после POST делает `GET` card заново).  
Экран: **Обзор** · `assignAnalystApplication`.

### Document requests

**`GET …/document-requests`** — полный список (открытые+закрытые). UI списка на экране Документы сейчас использует `card.openDocumentRequests`.

**`POST /analyst/applications/{id}/document-requests`**

```json
{ "docType": "LEASE_AGREEMENT", "comment": "Нужен актуальный договор аренды", "dueAt": "2026-10-28T18:00:00Z" }
```

201 → `{ request, applicationId, status, currentStep }` · `createAnalystDocumentRequest`.

**`POST …/document-requests/{request_id}/cancel`**

```json
{ "reason": "Клиент уже загрузил" }
```

На бэке есть; кнопки cancel в UI нет. Accept/reject загруженного файла клиентом — company document flow (отдельного analyst accept нет).

### Comments — чат с клиентом (`…/ai`)

**`GET /analyst/applications/{id}/comments`** → `CommentOut[]` (`isInternal`).  
**`POST /analyst/applications/{id}/comments`**

```json
{ "text": "Уточните обороты за август", "isInternal": false }
```

`isInternal: true` — только банк; `false` — видит предприниматель (+ notification).  
Код: `fetchAnalystComments` / `postAnalystComment` · poll ~12s в режиме клиента.  
Вкладка «AI» на том же экране — **локальный** помощник (не `POST /ai/chat`).

### `POST /analyst/applications/{id}/propose` — решение

```json
{
  "decision": "APPROVED",
  "reasonCodes": ["DSCR_OK"],
  "explanation": "Данных достаточно для предварительного одобрения",
  "comment": "Закрыть замечание по справке об оборотах",
  "offerAmount": 1500000,
  "offerTermMonths": 24,
  "offerRate": 17.9,
  "productId": "prod_turnover",
  "offerLabel": "Базовые условия"
}
```

`decision`: `APPROVED` | `REJECTED` | `COUNTEROFFERED` | `NEED_INFO`.

Ответ: `{ applicationId, status, currentStep, decisionId, decisionType, offerId, reasonCodes, explanation, offer }`.

Экран **Решение** · `proposeAnalystDecision`. Gate на фронте: open doc requests / warnings / failed checks (override «Всё равно одобрить»).

### Требуют внимания / SLA / история

| Экран | Источник | Статус |
|-------|----------|--------|
| Требуют внимания | `GET /analyst/applications?assigned_to_me=true` + клиентский filter; целевой ещё `GET /notifications` | live derived; отдельного `/analyst/attention` нет |
| Рабочий процесс и SLA | queue `countsByStatus` + `include_closed` | live derived |
| История | `statusHistory` + comments + decisions **из card** | live (без отдельного history API) |

### Чеклист `/analyst/*`

| Status | Method | Path |
|--------|--------|------|
| wired | `GET` | `/analyst/applications` |
| wired | `GET` | `/analyst/applications/{id}` |
| wired | `POST` | `/analyst/applications/{id}/assign` |
| wired | `GET` | `/analyst/applications/{id}/checks` |
| backend / UI via card | `GET` | `/analyst/applications/{id}/document-requests` |
| wired | `POST` | `/analyst/applications/{id}/document-requests` |
| backend only | `POST` | `/analyst/applications/{id}/document-requests/{id}/cancel` |
| wired | `GET` | `/analyst/applications/{id}/comments` |
| wired | `POST` | `/analyst/applications/{id}/comments` |
| wired | `POST` | `/analyst/applications/{id}/propose` |

**Целевые / дырки продукта:** notifications list/read; cancel doc-request в UI; risks/explain API (или wiring к checks+decisions); опц. `POST /ai/chat` с `applicationId`; document download/preview через company-scoped GET.

### Уведомления аналитика — `/app/notifications`

Код: `NotificationsPage.tsx` · при `isAnalystRole` отдельная лента (не предпринимательская): вкладки **SLA / Очередь / Документы / Система**, клики → `/app/analyst/cases/...`.

| Method | Path | Когда |
|--------|------|--------|
| `GET` | `/notifications` | список (`unread`, `type`, `limit`, `offset`) — целевой |
| `PATCH` | `/notifications/{id}` | `{ "isRead": true }` |
| `POST` | `/notifications/read-all` | прочитать все |

**Сейчас UI:** локальный демо-фид (SLA&lt;4ч, ответ клиента, ML unavailable, назначения). Типы prefs: просрочка SLA, очередь, назначения, docs клиента, автопроверки.

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

## Админ — кабинет (`/app/admin/*`)

Источник правды: `backend/app/api/v1/admin.py` + схемы `backend/app/schemas/admin.py`.  
Роль `ADMIN` + permission из таблицы. Фронт: `Protected roles={['admin']}`, меню `adminGroups` в `AppLayout`.  
**HTTP-клиент `api/admin.ts` пока нет** — все экраны на синтетике; ниже — эндпоинты, которые **требуются**, чтобы повесить UI на бэк.

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

### Навигация

| Группа | Пункт | Path |
|--------|-------|------|
| Система | Обзор | `/app/admin` |
| | Аналитика конвейера | `/app/admin/analytics` |
| Кредитный конвейер | Каталог продуктов | `/app/admin/products` |
| | Кредитная политика | `/app/admin/policy` |
| Администрирование | Пользователи и роли | `/app/admin/users` |
| | Аудит изменений | `/app/admin/audit` |

Уведомления — только колокольчик хедера → `/app/admin/notifications` (не в sidebar).  
Экранов Models / Runtime / Demo в меню нет — API есть, UI нет.

### UI ↔ требуемые эндпоинты (по экранам)

| Экран | Код · разделы UI | Требуемые эндпоинты | UI сейчас |
|-------|------------------|---------------------|-----------|
| `/app/admin` | `AdminOverviewPage` · KPI опер/продукт · заявки по неделям · воронка · микс/топ продуктов · цели · портфель · внимание · последние изменения · «Экспорт» / «Инцидент» | **Нет dedicated overview API.** Агрегаты можно собрать из: `GET /admin/credit-products`, `GET /admin/users`, `GET /admin/audit/events`, `GET /analyst/applications` (или будущий `GET /admin/overview`). Экспорт/инцидент — бэка нет | синтетика |
| `/app/admin/analytics` | `AdminAnalyticsPage` · фильтры период/продукт/канал/регион · KPI · воронка · отказы · продукт. доска · каналы · конверсия/время/объём · CSV | **Нет `/admin/analytics*`.** Целевой: conveyor metrics API; до него — audit + applications + products. CSV — клиент или `…/export` | синтетика |
| `/app/admin/products` | `AdminProductsPage` · таблица · требования · редактор · Новый / Импорт / Сохранить | `GET/POST /admin/credit-products` · `GET/PATCH /admin/credit-products/{id}` · `POST …/publish` · `POST …/archive` · `GET …/versions`. Импорт — **нет на бэке** | синтетика |
| `/app/admin/policy` | `AdminPolicyPage` · разделы правил · версии · DSL-редактор · diff · Проверить / Публикация | `GET/POST /admin/policies` · `GET/PATCH /admin/policies/{id}` · `GET …/versions` · `POST …/validate` · `POST …/simulate` · `GET …/simulations/{run_id}` · `POST …/publish` · `GET …/diff` | синтетика |
| `/app/admin/users` | `AdminUsersPage` · фильтры · bulk роль/блок · таблица · пригласить · матрица прав · экспорт | `GET/POST /admin/users` · `GET/PATCH /admin/users/{id}` · `POST …/disable` · `POST …/reset-credentials` · `GET /admin/roles` · `GET /admin/permissions` · members: `GET /admin/companies` · `GET/PUT/DELETE …/members/{user_id}`. Invite/bulk/export — **нет** (invite ≈ `POST /admin/users`) | синтетика |
| `/app/admin/audit` | `AdminAuditPage` · фильтры · журнал · CSV · проверка целостности | `GET /admin/audit/events` · `GET /admin/audit/events/{id}`. Export/verify — **нет на бэке** | синтетика |
| `/app/admin/notifications` | `AdminNotificationsPage` · лента · каналы · типы · прочитать все | общего admin notifications API **нет**; целевой `/notifications*` или admin prefs. Demo reset косвенно: `GET/POST /admin/demo/*` | локально |

**Нет UI, API есть (полный админ-продукт):**

| Область | Эндпоинты |
|---------|-----------|
| ML-модели | `GET /admin/models` · `…/active` · `…/evaluations` · `GET/POST …/{id}/validate|activate` · `GET …/{id}/evaluations` |
| Runtime | `GET/PATCH /admin/config/runtime` |
| Demo | `GET /admin/demo/scenarios` · `GET …/{id}` · `POST …/load` · `POST /admin/demo/reset` · `GET /admin/demo/jobs/{id}` |

### Чеклист всех маршрутов `admin.py`

| Status | Method | Path |
|--------|--------|------|
| required · UI users | `GET` | `/admin/roles` |
| required · UI users | `GET` | `/admin/permissions` |
| required · UI users | `GET` | `/admin/users` |
| required · UI users | `POST` | `/admin/users` |
| required · UI users | `GET` | `/admin/users/{user_id}` |
| required · UI users | `PATCH` | `/admin/users/{user_id}` |
| required · UI users | `POST` | `/admin/users/{user_id}/disable` |
| required · UI users | `POST` | `/admin/users/{user_id}/reset-credentials` |
| required · UI users | `GET` | `/admin/companies` |
| required · UI users | `GET` | `/admin/companies/{company_id}/members` |
| required · UI users | `PUT` | `/admin/companies/{company_id}/members/{user_id}` |
| required · UI users | `DELETE` | `/admin/companies/{company_id}/members/{user_id}` |
| required · UI products | `GET` | `/admin/credit-products` |
| required · UI products | `POST` | `/admin/credit-products` |
| required · UI products | `GET` | `/admin/credit-products/{product_id}` |
| required · UI products | `PATCH` | `/admin/credit-products/{product_id}` |
| required · UI products | `POST` | `/admin/credit-products/{product_id}/publish` |
| required · UI products | `POST` | `/admin/credit-products/{product_id}/archive` |
| required · UI products | `GET` | `/admin/credit-products/{product_id}/versions` |
| required · UI policy | `GET` | `/admin/policies` |
| required · UI policy | `POST` | `/admin/policies` |
| required · UI policy | `GET` | `/admin/policies/{policy_id}` |
| required · UI policy | `PATCH` | `/admin/policies/{policy_id}` |
| required · UI policy | `GET` | `/admin/policies/{policy_id}/versions` |
| required · UI policy | `POST` | `/admin/policies/{policy_id}/validate` |
| required · UI policy | `POST` | `/admin/policies/{policy_id}/simulate` |
| required · UI policy | `GET` | `/admin/policies/{policy_id}/simulations/{run_id}` |
| required · UI policy | `POST` | `/admin/policies/{policy_id}/publish` |
| required · UI policy | `GET` | `/admin/policies/{policy_id}/diff` |
| API only · no screen | `GET` | `/admin/models` |
| API only · no screen | `GET` | `/admin/models/active` |
| API only · no screen | `GET` | `/admin/models/evaluations` |
| API only · no screen | `GET` | `/admin/models/{model_id}` |
| API only · no screen | `POST` | `/admin/models/{model_id}/validate` |
| API only · no screen | `POST` | `/admin/models/{model_id}/activate` |
| API only · no screen | `GET` | `/admin/models/{model_id}/evaluations` |
| API only · no screen | `GET` | `/admin/config/runtime` |
| API only · no screen | `PATCH` | `/admin/config/runtime` |
| API only · no screen | `GET` | `/admin/demo/scenarios` |
| API only · no screen | `GET` | `/admin/demo/scenarios/{scenario_id}` |
| API only · no screen | `POST` | `/admin/demo/scenarios/{scenario_id}/load` |
| API only · no screen | `POST` | `/admin/demo/reset` |
| API only · no screen | `GET` | `/admin/demo/jobs/{job_id}` |
| required · UI audit | `GET` | `/admin/audit/events` |
| required · UI audit | `GET` | `/admin/audit/events/{event_id}` |

**Дырки продукта (UI хочет, бэка нет):** overview/analytics aggregates, product import, user invite/bulk/export, audit export/integrity, admin notifications/prefs, report incident.

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
