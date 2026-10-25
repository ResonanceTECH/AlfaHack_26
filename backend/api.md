# Линия решения — API Reference

Полный справочник REST-ручек /api/v1.

Спека: [Alfa_Business_Credit_API_Entrepreneur_Admin.md](../Alfa_Business_Credit_API_Entrepreneur_Admin.md) ·  
Swagger: http://localhost:8000/docs · ReDoc: http://localhost:8000/redoc

Обзор бэкенда / запуск: [README.md](README.md).

---

## Содержание

- [Базовые сведения](#базовые-сведения)
- [Аутентификация](#аутентификация)
- [Компании, реестр, финансы, обязательства, цели и потребности](#компании-реестр-финансы-обязательства-цели-и-потребности)
- [Кредитные продукты, подбор и расчёты](#кредитные-продукты-подбор-и-расчёты)
- [Заявки (company-scoped)](#заявки-company-scoped)
- [Уведомления](#уведомления)
- [Аналитик](#аналитик)
- [Админ](#админ)
- [Финансы, выписки, прогнозы](#финансы-выписки-прогнозы)
- [AI-агент](#ai-агент)
- [Устаревшие ручки](#устаревшие-ручки)
- [Примеры использования](#примеры-использования)


---

## Базовые сведения

### Базовый URL
```
http://localhost:8000/api/v1
```

### Формат
- JSON, поля в **camelCase**
- Деньги — строки `"2500000.00"`
- Ошибки:
```json
{
  "error": {
    "code": "HTTP_404",
    "message": "Заявка не найдена",
    "fields": null,
    "requestId": "…"
  }
}
```

### Коды статусов
- `200` / `201` / `202` / `204` — успех
- `400` / `401` / `403` / `404` / `409` / `413` / `422` / `429` — ошибки

### Аутентификация
```
Authorization: Bearer <accessToken>
```
Роли: `ENTREPRENEUR` | `ANALYST` | `ADMIN`. Публичной регистрации / OTP нет.

Опционально на мутациях: `X-Correlation-Id` (попадёт в audit).  
Для create/submit/accept оффера: `Idempotency-Key`.

### Демо-аккаунты (seed)
Пароль: **`demo1234`**

| Login | Роль |
|-------|------|
| `ip@demo.alfa` | ENTREPRENEUR (`company_001`) |
| `ooo@demo.alfa` | ENTREPRENEUR (`company_002`) |
| `analyst@demo.alfa` | ANALYST |
| `admin@demo.alfa` | ADMIN |

---

## Аутентификация

Демо: `ip@demo.alfa` / `demo1234` → компания `company_001`. Cookies: `alfa_access` (path `/`), `alfa_refresh` (path `/api/v1/auth`). Access TTL по умолчанию 30 мин (`expiresIn: 1800`).

### POST /api/v1/auth/login
Вход по логину и паролю. Публичный endpoint (регистрации/OTP нет). Rate-limit по login+IP.

**Аутентификация:** Не требуется

**Тело запроса:**
```json
{
  "login": "ip@demo.alfa",
  "password": "demo1234"
}
```

**Ответ (200):**
```json
{
  "accessToken": "<jwt>",
  "tokenType": "bearer",
  "expiresIn": 1800,
  "refreshToken": "<jwt>",
  "user": {
    "id": "user_ent_01",
    "email": "ip@demo.alfa",
    "phone": null,
    "fullName": "Иван Петров",
    "displayName": "Иван Петров",
    "role": "ENTREPRENEUR",
    "companyId": null,
    "permissions": [],
    "status": "ACTIVE"
  },
  "redirectTo": "/select-company"
}
```

`redirectTo`: ENTREPRENEUR → `/select-company`, ANALYST → `/bank/queue`, ADMIN → `/admin`.

**Ошибки:**
- `401` — неверный логин/пароль
- `429` — превышен rate-limit

---

### POST /api/v1/auth/refresh
Ротация refresh: body `refreshToken` или cookie `alfa_refresh`. Старый jti отзывается; reuse отозванного → logout-all.

**Аутентификация:** Не требуется (нужен валидный refresh)

**Тело запроса:**
```json
{
  "refreshToken": "<jwt>"
}
```

**Ответ (200):**
```json
{
  "accessToken": "<jwt>",
  "tokenType": "bearer",
  "expiresIn": 1800,
  "refreshToken": "<jwt>"
}
```

**Ошибки:**
- `401` — нет токена / недействительный / отозван / истёк / не refresh-тип

---

### POST /api/v1/auth/logout
Отзыв текущего refresh + очистка cookies.

**Аутентификация:** Требуется

**Тело запроса:** (опционально)
```json
{
  "refreshToken": "<jwt>"
}
```

**Ответ (200):**
```json
{
  "message": "ok"
}
```

---

### POST /api/v1/auth/logout-all
Отзыв всех сессий пользователя + очистка cookies.

**Аутентификация:** Требуется

**Ответ (200):**
```json
{
  "message": "revoked:3"
}
```

---

### GET /api/v1/auth/me
Текущий пользователь: роль, permissions, статус.

**Аутентификация:** Требуется

**Ответ (200):**
```json
{
  "id": "user_ent_01",
  "email": "ip@demo.alfa",
  "phone": null,
  "fullName": "Иван Петров",
  "displayName": "Иван Петров",
  "role": "ENTREPRENEUR",
  "companyId": null,
  "permissions": [],
  "status": "ACTIVE"
}
```

**Ошибки:**
- `401` — нет/просрочен access

---

## Компании, реестр, финансы, обязательства, цели и потребности

Tenant: чужая компания → **404** (не 403). ADMIN на клиентских `/companies/*` → **403** («работайте через `/admin/*`»). Write — membership OWNER/MEMBER (не VIEWER).

### GET /api/v1/companies
Список доступных компаний. ENTREPRENEUR — по membership; ANALYST — компании с не-DRAFT заявками.

**Аутентификация:** Требуется (ENTREPRENEUR / ANALYST)

**Ответ (200):**
```json
[
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
]
```

**Ошибки:**
- `403` — роль ADMIN

---

### POST /api/v1/companies
Создать компанию + membership OWNER. ИНН: 12 цифр для IP, 10 для OOO.

**Аутентификация:** Требуется (роль ENTREPRENEUR)

**Тело запроса:**
```json
{
  "inn": "770123456703",
  "name": "ИП Петров Иван Сергеевич",
  "legalForm": "IP",
  "industry": "Розничная торговля",
  "registrationDate": "2019-03-15",
  "region": "Москва",
  "ogrn": "304770100012345",
  "employeesCount": 8
}
```

**Ответ (201):**
```json
{
  "id": "company_...",
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
  "membershipRole": "OWNER",
  "membershipPermissions": {
    "read": true,
    "write": true,
    "submit": true
  }
}
```

**Ошибки:**
- `409` — ИНН уже занят
- `422` — длина ИНН не соответствует legalForm
- `403` — не ENTREPRENEUR

---

### GET /api/v1/companies/{companyId}
Карточка компании + membership текущего пользователя.

**Аутентификация:** Требуется (доступ к компании)

**Path параметры:**
- `companyId` — например `company_001`

**Ответ (200):**
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
  "membershipRole": "OWNER",
  "membershipPermissions": {
    "read": true,
    "write": true,
    "submit": true
  }
}
```

**Ошибки:**
- `404` — нет доступа / компания не найдена

---

### PATCH /api/v1/companies/{companyId}
Редактирование профиля. Optimistic lock: `version` → при конфликте 409, иначе version++.

**Аутентификация:** Требуется (write в компании)

**Path параметры:**
- `companyId`

**Тело запроса:**
```json
{
  "name": "ИП Петров Иван Сергеевич",
  "industry": "Розничная торговля",
  "region": "Москва",
  "employeesCount": 10,
  "version": 1
}
```

**Ответ (200):** как `CompanyOut` с обновлённым `version`.

**Ошибки:**
- `404` — компания недоступна
- `409` — конфликт version
- `403` — VIEWER / аналитик write

---

### GET /api/v1/companies/{companyId}/dashboard
KPI, заявки, задачи, уведомления, рекомендации.

**Аутентификация:** Требуется (доступ к компании)

**Path параметры:**
- `companyId`

**Ответ (200):**
```json
{
  "company": {
    "id": "company_001",
    "name": "ИП Петров Иван Сергеевич",
    "inn": "770123456703",
    "legalForm": "IP",
    "registryStatus": "ACTIVE",
    "region": "Москва"
  },
  "kpi": {
    "period": "2026-09",
    "avgMonthlyRevenue": "900000.00",
    "operatingExpenses": "650000.00",
    "cashBalance": "420000.00",
    "liabilities": "180000.00",
    "activeCredits": "150000.00",
    "netCashflow": "250000.00",
    "applicationsTotal": 4,
    "applicationsActive": 3,
    "unreadNotifications": 2,
    "openTasks": 1,
    "currency": "RUB"
  },
  "applications": [
    {
      "id": "app_approved_01",
      "status": "APPROVED",
      "productId": "working_capital_01",
      "productName": "Оборотный кредит «Сезон»",
      "amount": "2000000.00",
      "termMonths": 12,
      "readinessScore": 78,
      "updatedAt": "2026-10-24T12:00:00Z"
    }
  ],
  "tasks": [],
  "notifications": [],
  "recommendations": [],
  "generatedAt": "2026-10-26T08:00:00Z"
}
```

**Ошибки:**
- `404` — компания недоступна

---

### POST /api/v1/registry/companies/lookup
Поиск в синтетическом реестре по ИНН. Auth обязателен, tenant не проверяется.

**Аутентификация:** Требуется

**Тело запроса:**
```json
{
  "inn": "770123456703"
}
```

**Ответ (200):**
```json
{
  "found": true,
  "source": "SYNTHETIC_REGISTRY",
  "company": {
    "inn": "770123456703",
    "legalForm": "IP",
    "name": "ИП Петров Иван Сергеевич",
    "registrationDate": "2019-03-15",
    "region": "Москва",
    "registryStatus": "ACTIVE",
    "ogrn": "304770100012345"
  },
  "checkedAt": "2026-10-26T08:00:00Z",
  "innValid": true
}
```

**Ошибки:**
- `422` — ИНН не из цифр / не 10 и не 12

---

### POST /api/v1/companies/{companyId}/registry/verify
Сверка компании с демореестром, snapshot + audit.

**Аутентификация:** Требуется (write в компании)

**Path параметры:**
- `companyId`

**Ответ (200):**
```json
{
  "snapshotId": "reg_...",
  "found": true,
  "source": "SYNTHETIC_REGISTRY",
  "company": {
    "inn": "770123456703",
    "legalForm": "IP",
    "name": "ИП Петров Иван Сергеевич",
    "registrationDate": "2019-03-15",
    "region": "Москва",
    "registryStatus": "ACTIVE",
    "ogrn": "304770100012345"
  },
  "comparison": {
    "match": true,
    "checks": {
      "name": true,
      "legalForm": true,
      "region": true
    },
    "mismatches": [],
    "registryStatus": "ACTIVE"
  },
  "registryStatus": "ACTIVE",
  "checkedAt": "2026-10-26T08:00:00Z"
}
```

**Ошибки:**
- `404` — компания недоступна

---

### GET /api/v1/companies/{companyId}/registry/history
История registry snapshot'ов (новые сверху).

**Аутентификация:** Требуется (доступ к компании)

**Path параметры:**
- `companyId`

**Ответ (200):**
```json
[
  {
    "id": "reg_ip_001",
    "inn": "770123456703",
    "found": true,
    "source": "SYNTHETIC_REGISTRY",
    "registryStatus": "ACTIVE",
    "checkedAt": "2026-10-24T10:00:00Z",
    "payload": {
      "name": "ИП Петров Иван Сергеевич",
      "legalForm": "IP",
      "status": "ACTIVE"
    }
  }
]
```

---

### GET /api/v1/companies/{companyId}/financials
Последний `FinancialSnapshot`.

**Аутентификация:** Требуется (доступ к компании)

**Path параметры:**
- `companyId`

**Ответ (200):**
```json
{
  "id": "fs_001",
  "companyId": "company_001",
  "period": "2026-09",
  "avgMonthlyRevenue": "900000.00",
  "operatingExpenses": "650000.00",
  "cashBalance": "420000.00",
  "liabilities": "180000.00",
  "activeCredits": "150000.00",
  "source": "aggregated",
  "confirmed": true,
  "updatedAt": "2026-10-24T10:00:00Z",
  "currency": "RUB"
}
```

**Ошибки:**
- `404` — снимок не найден / нет доступа

---

### PATCH /api/v1/companies/{companyId}/financials
Создать или обновить снимок (если нет — создаётся с дефолтами).

**Аутентификация:** Требуется (write в компании)

**Path параметры:**
- `companyId`

**Тело запроса:**
```json
{
  "period": "2026-09",
  "avgMonthlyRevenue": "900000.00",
  "operatingExpenses": "650000.00",
  "cashBalance": "420000.00",
  "liabilities": "180000.00",
  "activeCredits": "150000.00",
  "source": "manual",
  "confirmed": true
}
```

**Ответ (200):** `FinancialSnapshotOut` как выше.

**Ошибки:**
- `404` — нет доступа к компании
- `403` — нет write

---

### GET /api/v1/obligations
Обязательства компании. `companyId` опционален — резолвится из membership.

**Аутентификация:** Требуется (ENTREPRENEUR)

**Query параметры:**
- `companyId` — опционально, например `company_001`

**Ответ (200):**
```json
[
  {
    "id": "ob_1",
    "companyId": "company_001",
    "type": "rent",
    "title": "Аренда склада",
    "amount": "120000.00",
    "dueDate": "2026-11-05",
    "recurring": true,
    "status": "planned",
    "currency": "RUB"
  }
]
```

---

### POST /api/v1/obligations
Создать обязательство.

**Аутентификация:** Требуется (write в компании)

**Тело запроса:**
```json
{
  "type": "supplier",
  "title": "Оплата поставщику",
  "amount": "450000.00",
  "dueDate": "2026-10-28",
  "recurring": false,
  "status": "planned",
  "currency": "RUB",
  "companyId": "company_001"
}
```

**Ответ (201):** `ObligationOut`.

---

### PATCH /api/v1/obligations/{obligationId}
Обновить обязательство.

**Аутентификация:** Требуется (write в компании обязательства)

**Path параметры:**
- `obligationId`

**Тело запроса:**
```json
{
  "amount": "130000.00",
  "status": "paid",
  "dueDate": "2026-11-05"
}
```

**Ответ (200):** `ObligationOut`.

**Ошибки:**
- `404` — обязательство не найдено

---

### GET /api/v1/business-goals
Статический каталог целей финансирования.

**Аутентификация:** Требуется

**Ответ (200):**
```json
[
  {
    "code": "inventory_purchase",
    "title": "Закупка товара / запасов",
    "description": "Финансирование оборотных запасов и сезонных закупок",
    "typicalProducts": ["working_capital", "credit_line", "overdraft"]
  },
  {
    "code": "new_point",
    "title": "Открытие новой точки",
    "description": "Аренда, ремонт, первоначальные затраты на точку продаж",
    "typicalProducts": ["investment", "credit_line"]
  },
  {
    "code": "equipment",
    "title": "Оборудование",
    "description": "Покупка или модернизация основных средств",
    "typicalProducts": ["investment"]
  },
  {
    "code": "production_expansion",
    "title": "Расширение производства",
    "description": "Увеличение мощностей и масштабирование",
    "typicalProducts": ["investment", "credit_line"]
  },
  {
    "code": "cash_gap",
    "title": "Кассовый разрыв",
    "description": "Краткосрочное покрытие разрыва ликвидности",
    "typicalProducts": ["overdraft", "working_capital"]
  },
  {
    "code": "other",
    "title": "Другое",
    "description": "Иная бизнес-цель",
    "typicalProducts": ["working_capital", "credit_line", "investment", "overdraft"]
  }
]
```

---

### GET /api/v1/companies/{companyId}/funding-needs
Список потребностей финансирования + items.

**Аутентификация:** Требуется (доступ к компании)

**Path параметры:**
- `companyId`

**Ответ (200):**
```json
[
  {
    "id": "need_001",
    "companyId": "company_001",
    "goalType": "inventory_purchase",
    "title": "Закупка сезонной партии товаров для дома",
    "description": "Перед высоким сезоном нужна доп. партия; комбинируем оборотный + линию.",
    "costs": {
      "goods": "2500000.00",
      "logistics": "80000.00",
      "reserve": "150000.00"
    },
    "items": [
      {
        "id": "need_item_01",
        "needId": "need_001",
        "name": "Товары для дома",
        "amount": "2500000.00",
        "quantity": 1,
        "unit": "лот",
        "meta": {},
        "createdAt": "2026-10-20T10:00:00Z"
      }
    ],
    "reserve": "150000.00",
    "ownFunds": "230000.00",
    "otherFunding": "0.00",
    "requiredAmount": "2500000.00",
    "targetDate": "2026-11-15",
    "termMonths": 12,
    "urgency": "MEDIUM",
    "status": "ACTIVE",
    "currency": "RUB",
    "createdAt": "2026-10-20T10:00:00Z",
    "updatedAt": "2026-10-20T10:00:00Z"
  }
]
```

---

### POST /api/v1/companies/{companyId}/funding-needs
Создать потребность. Нужны `costs` и/или `items` и/или `requiredAmount`. Сервер считает `requiredAmount`.

**Аутентификация:** Требуется (write в компании)

**Path параметры:**
- `companyId`

**Тело запроса:**
```json
{
  "goalType": "inventory_purchase",
  "title": "Закупка сезонной партии",
  "description": "Товар под высокий сезон",
  "costs": {
    "goods": "2500000.00"
  },
  "items": [
    {
      "name": "Товары для дома",
      "amount": "2500000.00",
      "quantity": 1,
      "unit": "лот"
    }
  ],
  "reserve": "150000.00",
  "ownFunds": "230000.00",
  "otherFunding": "0.00",
  "targetDate": "2026-11-15",
  "termMonths": 12,
  "urgency": "MEDIUM",
  "currency": "RUB"
}
```

**Ответ (201):** `FundingNeedOut`.

**Ошибки:**
- `422` — нет costs/items/requiredAmount
- `404` — нет доступа

---

### GET /api/v1/companies/{companyId}/funding-needs/{needId}
Одна потребность.

**Аутентификация:** Требуется (доступ к компании)

**Path параметры:**
- `companyId`, `needId` (например `need_001`)

**Ответ (200):** `FundingNeedOut`.

**Ошибки:**
- `404` — потребность не найдена / чужая компания

---

### PATCH /api/v1/companies/{companyId}/funding-needs/{needId}
Патч; пересчёт `requiredAmount` (если не передан явно).

**Аутентификация:** Требуется (write в компании)

**Path параметры:**
- `companyId`, `needId`

**Тело запроса:**
```json
{
  "title": "Закупка сезонной партии (обновлено)",
  "ownFunds": "300000.00",
  "termMonths": 18,
  "urgency": "HIGH"
}
```

**Ответ (200):** `FundingNeedOut`.

**Ошибки:**
- `404` — потребность не найдена

---

### DELETE /api/v1/companies/{companyId}/funding-needs/{needId}
Soft-archive (`status: ARCHIVED`), не hard-delete. Возвращает обновлённую потребность.

**Аутентификация:** Требуется (write в компании)

**Path параметры:**
- `companyId`, `needId`

**Ответ (200):** `FundingNeedOut` со `status: "ARCHIVED"`.

**Ошибки:**
- `404` — потребность не найдена

---

### POST /api/v1/companies/{companyId}/funding-needs/{needId}/items
Добавить статью бюджета; пересчёт costs/requiredAmount.

**Аутентификация:** Требуется (write в компании)

**Path параметры:**
- `companyId`, `needId`

**Тело запроса:**
```json
{
  "name": "Логистика",
  "amount": "80000.00",
  "quantity": 1,
  "unit": "услуга",
  "meta": {}
}
```

**Ответ (201):**
```json
{
  "id": "need_item_...",
  "needId": "need_001",
  "name": "Логистика",
  "amount": "80000.00",
  "quantity": 1,
  "unit": "услуга",
  "meta": {},
  "createdAt": "2026-10-26T08:00:00Z"
}
```

**Ошибки:**
- `404` — потребность не найдена

---

### PATCH /api/v1/companies/{companyId}/funding-needs/{needId}/items/{itemId}
Обновить статью; пересчёт бюджета.

**Аутентификация:** Требуется (write в компании)

**Path параметры:**
- `companyId`, `needId`, `itemId`

**Тело запроса:**
```json
{
  "amount": "90000.00",
  "quantity": 1
}
```

**Ответ (200):** `FundingNeedItemOut`.

**Ошибки:**
- `404` — потребность / статья не найдена

---

### DELETE /api/v1/companies/{companyId}/funding-needs/{needId}/items/{itemId}
Удалить статью; пересчёт бюджета.

**Аутентификация:** Требуется (write в компании)

**Path параметры:**
- `companyId`, `needId`, `itemId`

**Ответ (204):** без тела

**Ошибки:**
- `404` — потребность / статья не найдена

---

## Кредитные продукты, подбор и расчёты

Каталог только **PUBLISHED**. Подбор пишет `CreditRecommendation`. `isOfficialOffer: false`, `scoreMeaning: PRODUCT_FIT_NOT_APPROVAL_PROBABILITY`.

### GET /api/v1/credit-products
Опубликованный каталог + `catalogVersion`.

**Аутентификация:** Требуется

**Ответ (200):**
```json
{
  "catalogVersion": "catalog-v1",
  "items": [
    {
      "id": "working_capital_01",
      "code": "working_capital_01",
      "name": "Оборотный кредит «Сезон»",
      "type": "working_capital",
      "description": "Финансирование закупок и покрытия кассовых разрывов под торговый оборот.",
      "amountMin": "500000.00",
      "amountMax": "15000000.00",
      "termMin": 3,
      "termMax": 36,
      "rateMin": "18.50",
      "rateMax": "24.00",
      "collateralRequired": false,
      "legalForms": ["IP", "OOO"],
      "suitableGoals": ["inventory_purchase", "cash_gap", "other"],
      "status": "PUBLISHED",
      "version": 1,
      "currency": "RUB"
    }
  ]
}
```

---

### GET /api/v1/credit-products/{productId}
Карточка продукта (id или code). Только published.

**Аутентификация:** Требуется

**Path параметры:**
- `productId` — `working_capital_01`

**Ответ (200):**
```json
{
  "id": "working_capital_01",
  "code": "working_capital_01",
  "name": "Оборотный кредит «Сезон»",
  "type": "working_capital",
  "description": "Финансирование закупок и покрытия кассовых разрывов под торговый оборот.",
  "amountMin": "500000.00",
  "amountMax": "15000000.00",
  "termMin": 3,
  "termMax": 36,
  "rateMin": "18.50",
  "rateMax": "24.00",
  "collateralRequired": false,
  "legalForms": ["IP", "OOO"],
  "minBusinessAgeMonths": 12,
  "suitableGoals": ["inventory_purchase", "cash_gap", "other"],
  "documents": ["Паспорт", "Выписка ЕГРИП", "Банковская выписка 6 мес.", "Карточка счёта 51"],
  "fees": [
    {
      "name": "Комиссия за выдачу",
      "type": "percent",
      "value": "0.50"
    }
  ],
  "scheduleTypes": ["annuity", "differentiated"],
  "features": [],
  "eligibilityRules": {},
  "rules": [
    {
      "id": "...",
      "ruleType": "eligibility",
      "parameters": {
        "min_age_months": 12,
        "legal_forms": ["IP", "OOO"],
        "goals": ["inventory_purchase", "cash_gap", "other"]
      },
      "version": "demo-rules-v1"
    }
  ],
  "status": "PUBLISHED",
  "version": 1,
  "catalogVersion": "catalog-v1",
  "currency": "RUB"
}
```

**Ошибки:**
- `404` — продукт не найден / не published

---

### POST /api/v1/companies/{companyId}/credit-matches
Подбор продуктов по financials + need/amount/term/goal. Без `fundingNeedId` — latest ACTIVE need. Без financials → 400.

**Аутентификация:** Требуется (доступ к компании)

**Path параметры:**
- `companyId`

**Тело запроса:**
```json
{
  "fundingNeedId": "need_001",
  "requestedAmount": "2000000.00",
  "termMonths": 12,
  "currency": "RUB",
  "goalType": "inventory_purchase"
}
```

**Ответ (200):**
```json
{
  "companyId": "company_001",
  "fundingNeedId": "need_001",
  "catalogVersion": "catalog-v1",
  "policyVersion": "SMB_DEFAULT_v1@v1",
  "requestedAmount": "2000000.00",
  "termMonths": 12,
  "currency": "RUB",
  "goalType": "inventory_purchase",
  "recommendations": [
    {
      "productId": "working_capital_01",
      "productName": "Оборотный кредит «Сезон»",
      "productType": "working_capital",
      "eligibleByBasicRules": true,
      "rankingScore": "85.00",
      "scoreMeaning": "PRODUCT_FIT_NOT_APPROVAL_PROBABILITY",
      "estimatedMonthlyPayment": "186500.00",
      "estimatedRate": "21.25",
      "recommendedAmount": "2000000.00",
      "recommendedTerm": 12,
      "reasons": ["Подходит по сумме и сроку", "Цель совпадает с продуктом"],
      "limitations": [
        "Итоговые условия определяются только после рассмотрения заявки"
      ]
    }
  ],
  "isOfficialOffer": false,
  "modelVersion": "demo-rules-v1"
}
```

**Ошибки:**
- `400` — нет financials; или не указаны need / amount+term+goal
- `404` — компания / потребность не найдена

---

### POST /api/v1/credit-products/compare
Сравнение 2–3 продуктов. Опционально amount/term → `fitsRequest` и оценка платежа.

**Аутентификация:** Требуется

**Тело запроса:**
```json
{
  "productIds": ["working_capital_01", "credit_line_01"],
  "amount": "2000000.00",
  "termMonths": 12
}
```

**Ответ (200):**
```json
{
  "catalogVersion": "catalog-v1",
  "amount": "2000000.00",
  "termMonths": 12,
  "products": [
    {
      "productId": "working_capital_01",
      "productName": "Оборотный кредит «Сезон»",
      "productType": "working_capital",
      "amountMin": "500000.00",
      "amountMax": "15000000.00",
      "termMin": 3,
      "termMax": 36,
      "rateMin": "18.50",
      "rateMax": "24.00",
      "collateralRequired": false,
      "legalForms": ["IP", "OOO"],
      "suitableGoals": ["inventory_purchase", "cash_gap", "other"],
      "documents": ["Паспорт", "Выписка ЕГРИП", "Банковская выписка 6 мес.", "Карточка счёта 51"],
      "fees": [
        {
          "name": "Комиссия за выдачу",
          "type": "percent",
          "value": "0.50"
        }
      ],
      "scheduleTypes": ["annuity", "differentiated"],
      "estimatedMonthlyPayment": "186500.00",
      "estimatedRate": "21.25",
      "fitsRequest": true,
      "notes": []
    }
  ],
  "highlights": [
    "Минимальная ставка у «Возобновляемая кредитная линия»: от 17.90%",
    "Без обязательного залога: «Оборотный кредит «Сезон»», «Возобновляемая кредитная линия»",
    "Подходят под запрос: «Оборотный кредит «Сезон»»"
  ]
}
```

**Ошибки:**
- `422` — меньше 2 / больше 3 id, дубликаты
- `404` — продукт не найден

---

### POST /api/v1/credit-calculations
График платежей. Нужны `annualRatePercent` или `productId`. При product — сумма/срок валидируются по каталогу.

**Аутентификация:** Требуется

**Тело запроса:**
```json
{
  "productId": "working_capital_01",
  "amount": "2000000.00",
  "currency": "RUB",
  "termMonths": 12,
  "annualRatePercent": "20.50",
  "repaymentType": "ANNUITY",
  "startDate": "2026-11-01"
}
```

`repaymentType`: `ANNUITY` / `DIFFERENTIATED` (также `annuity`, `аннуитет`, `diff`).

**Ответ (200):**
```json
{
  "productId": "working_capital_01",
  "amount": "2000000.00",
  "termMonths": 12,
  "annualRatePercent": "20.50",
  "repaymentType": "annuity",
  "monthlyPayment": "186500.00",
  "totalPayments": "2238000.00",
  "overpayment": "238000.00",
  "totalFees": "10000.00",
  "rateSource": "catalog",
  "rateWithinCatalog": true,
  "schedule": [
    {
      "month": 1,
      "date": "2026-12-01",
      "principal": "152333.33",
      "interest": "34166.67",
      "payment": "186500.00",
      "remainingPrincipal": "1847666.67",
      "fees": "0.00"
    }
  ],
  "currency": "RUB",
  "disclaimer": "Расчёт демонстрационный. Не является офертой или кредитным решением банка."
}
```

**Ошибки:**
- `422` — сумма/срок вне каталога продукта; нет rate и productId
- `404` — продукт не найден

---

### POST /api/v1/projects/evaluate
Демо-оценка инвестпроекта (NPV / IRR / payback).

**Аутентификация:** Требуется

**Тело запроса:**
```json
{
  "initialInvestment": "3000000.00",
  "ownFunds": "1000000.00",
  "creditAmount": "2000000.00",
  "additionalSales": "400000.00",
  "variableCosts": "150000.00",
  "fixedCosts": "80000.00",
  "taxRate": "0.00",
  "horizonMonths": 36,
  "residualValue": "0.00",
  "discountRate": "12.00",
  "creditRate": "20.50",
  "creditTermMonths": 24,
  "currency": "RUB"
}
```

**Ответ (200):**
```json
{
  "simplePaybackMonths": 18,
  "discountedPaybackMonths": 22,
  "npv": "450000.00",
  "irr": "18.50",
  "roi": "35.00",
  "breakEvenUnits": null,
  "cashFlows": [
    {
      "month": 0,
      "cf": "-3000000.00",
      "cumulative": "-3000000.00",
      "discounted": "-3000000.00"
    }
  ],
  "currency": "RUB"
}
```

---

## Заявки (company-scoped)

Префикс: `/companies/{companyId}/applications`. ANALYST не видит DRAFT в списке. Write — ENTREPRENEUR с write-membership. Seed: `app_approved_01`, `app_counter_01`, `app_docs_01`, продукт `working_capital_01`.

### GET /api/v1/companies/{companyId}/applications
Список заявок компании.

**Аутентификация:** Требуется (доступ к компании)

**Path параметры:**
- `companyId`

**Query параметры:**
- `status` — фильтр `ApplicationStatus` (например `APPROVED`)

**Ответ (200):**
```json
[
  {
    "id": "app_approved_01",
    "companyId": "company_001",
    "fundingNeedId": "need_001",
    "productId": "working_capital_01",
    "productName": "Оборотный кредит «Сезон»",
    "productType": "working_capital",
    "goalType": "inventory_purchase",
    "status": "APPROVED",
    "currentStep": "DECISION",
    "version": 1,
    "amount": "2000000.00",
    "requestedAmount": "2000000.00",
    "termMonths": 12,
    "rate": "20.50",
    "purpose": "Сезонная закупка — одобренный кейс",
    "assignedManagerId": "user_analyst_01",
    "assignedManagerName": "Анна Соколова",
    "readinessScore": 78,
    "documents": [],
    "comments": [],
    "statusHistory": [
      {
        "status": "APPROVED",
        "at": "2026-10-24T12:00:00Z",
        "by": "Анна Соколова"
      }
    ],
    "createdAt": "2026-10-20T10:00:00Z",
    "updatedAt": "2026-10-24T12:00:00Z",
    "savedAt": null,
    "submittedAt": "2026-10-22T10:00:00Z",
    "aiSummary": "Предварительно одобрено. Не является офертой банка.",
    "applicationNumber": null,
    "currency": "RUB"
  }
]
```

---

### GET /api/v1/companies/{companyId}/applications/drafts
Только черновики.

**Аутентификация:** Требуется (доступ к компании)

**Path параметры:**
- `companyId`

**Ответ (200):** `list[ApplicationOut]` со `status: "DRAFT"`.

---

### POST /api/v1/companies/{companyId}/applications
Создать DRAFT. Повтор с тем же `Idempotency-Key` возвращает существующую заявку.

**Аутентификация:** Требуется (write в компании)

**Path параметры:**
- `companyId`

**Headers:**
- `Idempotency-Key` — рекомендуется

**Тело запроса:**
```json
{
  "fundingNeedId": "need_001",
  "productId": "working_capital_01",
  "requestedAmount": "2000000.00",
  "termMonths": 12,
  "rate": "20.50",
  "purpose": "Закупка товара",
  "goalType": "inventory_purchase",
  "currency": "RUB"
}
```

**Ответ (201):**
```json
{
  "id": "app_...",
  "status": "DRAFT",
  "currentStep": "CREDIT_PARAMETERS",
  "version": 1,
  "savedAt": "2026-10-26T08:00:00Z",
  "companyId": "company_001",
  "productId": "working_capital_01",
  "requestedAmount": "2000000.00",
  "termMonths": 12
}
```

**Ошибки:**
- `404` — продукт / потребность не найдены
- `403` — нет write

---

### GET /api/v1/companies/{companyId}/applications/{applicationId}
Карточка заявки.

**Аутентификация:** Требуется (доступ к заявке)

**Path параметры:**
- `companyId`, `applicationId`

**Ответ (200):** `ApplicationOut`.

**Ошибки:**
- `404` — заявка не найдена / другая компания

---

### PATCH /api/v1/companies/{companyId}/applications/{applicationId}
Редактирование только DRAFT. Optimistic lock: body `version` или header `If-Match`.

**Аутентификация:** Требуется (write)

**Path параметры:**
- `companyId`, `applicationId`

**Headers:**
- `If-Match` — опционально, число version

**Тело запроса:**
```json
{
  "requestedAmount": "2500000.00",
  "termMonths": 18,
  "purpose": "Закупка + логистика",
  "productId": "working_capital_01",
  "version": 1
}
```

**Ответ (200):** `ApplicationOut` с version++.

**Ошибки:**
- `400` — не DRAFT; `If-Match` не число
- `409` — конфликт version
- `404` — заявка / продукт / need

---

### DELETE /api/v1/companies/{companyId}/applications/{applicationId}
Удалить только DRAFT.

**Аутентификация:** Требуется (write)

**Path параметры:**
- `companyId`, `applicationId`

**Ответ (204):** без тела

**Ошибки:**
- `400` — не черновик
- `404` — не найдена

---

### GET /api/v1/companies/{companyId}/applications/{applicationId}/validation
Проверка готовности к отправке.

**Аутентификация:** Требуется (доступ к заявке)

**Path параметры:**
- `companyId`, `applicationId`

**Ответ (200):**
```json
{
  "applicationId": "app_...",
  "status": "DRAFT",
  "canSubmit": true,
  "errors": [],
  "warnings": [
    {
      "field": "documents",
      "code": "RECOMMENDED",
      "message": "Рекомендуется загрузить выписку"
    }
  ],
  "readinessScore": 72,
  "checkedAt": "2026-10-26T08:00:00Z"
}
```

---

### POST /api/v1/companies/{companyId}/applications/{applicationId}/submit
Отправка заявки. Авто: workflow + scoring. Повтор с тем же Idempotency-Key идемпотентен.

**Аутентификация:** Требуется (write)

**Path параметры:**
- `companyId`, `applicationId`

**Headers:**
- `Idempotency-Key` — рекомендуется

**Ответ (202):**
```json
{
  "applicationId": "app_...",
  "applicationNumber": "APP-2026-00042",
  "status": "SUBMITTED",
  "workflowId": "wf_...",
  "nextStep": "AUTOMATED_VALIDATION"
}
```

**Ошибки:**
- `400` — недопустимый статус (не DRAFT / DOCS_REQUESTED / … и не idempotent replay)
- `422` — валидация fail (`errors` / `warnings` в detail)
- `404` — заявка не найдена

---

### GET /api/v1/companies/{companyId}/applications/{applicationId}/status
Публичный статус + nextAction.

**Аутентификация:** Требуется (доступ к заявке)

**Path параметры:**
- `companyId`, `applicationId`

**Ответ (200):**
```json
{
  "applicationId": "app_approved_01",
  "status": "APPROVED",
  "currentStep": "DECISION",
  "nextAction": "Рассмотрите предложение банка",
  "applicationNumber": null,
  "updatedAt": "2026-10-24T12:00:00Z"
}
```

---

### GET /api/v1/companies/{companyId}/applications/{applicationId}/checks
Публичные checks (без internal audience).

**Аутентификация:** Требуется (доступ к заявке)

**Path параметры:**
- `companyId`, `applicationId`

**Ответ (200):**
```json
{
  "applicationId": "app_approved_01",
  "status": "APPROVED",
  "checks": [
    {
      "id": "chk_approved_01",
      "checkKey": "DEBT_BURDEN",
      "status": "PASSED",
      "score": 80,
      "reasonCodes": ["OK_DEBT_BURDEN"],
      "explanation": "Долговая нагрузка в пределах политики.",
      "createdAt": "2026-10-24T11:00:00Z"
    }
  ]
}
```

---

### GET /api/v1/companies/{companyId}/applications/{applicationId}/comments
Переписка без `isInternal`.

**Аутентификация:** Требуется (доступ к заявке)

**Path параметры:**
- `companyId`, `applicationId`

**Ответ (200):**
```json
[
  {
    "id": "cmt_...",
    "authorId": "user_ent_01",
    "authorName": "Иван Петров",
    "authorRole": "ENTREPRENEUR",
    "text": "Готовы предоставить доп. выписку",
    "createdAt": "2026-10-25T09:00:00Z",
    "isInternal": false
  }
]
```

---

### POST /api/v1/companies/{companyId}/applications/{applicationId}/comments
Сообщение клиента банку (`isInternal` всегда false). Уведомляет assigned analyst.

**Аутентификация:** Требуется (write)

**Path параметры:**
- `companyId`, `applicationId`

**Тело запроса:**
```json
{
  "text": "Готовы предоставить доп. выписку по запросу"
}
```

**Ответ (201):** `CommentOut`.

**Ошибки:**
- `422` — пустой текст
- `404` — заявка не найдена

---

### GET /api/v1/companies/{companyId}/applications/{applicationId}/decision
Публичное решение банка.

**Аутентификация:** Требуется (доступ к заявке)

**Path параметры:**
- `companyId`, `applicationId` (seed: `app_approved_01`)

**Ответ (200):**
```json
{
  "applicationId": "app_approved_01",
  "decision": "APPROVED",
  "decisionScope": "DEMO_PRELIMINARY",
  "reasonCodes": [
    {
      "code": "STABLE_CASHFLOW",
      "title": "STABLE_CASHFLOW",
      "details": null
    },
    {
      "code": "OK_DEBT_BURDEN",
      "title": "OK_DEBT_BURDEN",
      "details": null
    }
  ],
  "policyVersion": "SMB_DEFAULT_v1@v1",
  "updatedAt": "2026-10-24T12:00:00Z",
  "explanation": "Предварительное одобрение на запрошенных условиях."
}
```

**Ошибки:**
- `404` — решение ещё не сформировано

---

### GET /api/v1/companies/{companyId}/applications/{applicationId}/offers
Список офферов.

**Аутентификация:** Требуется (доступ к заявке)

**Path параметры:**
- `companyId`, `applicationId`

**Ответ (200):**
```json
[
  {
    "id": "offer_approved_01",
    "applicationId": "app_approved_01",
    "decisionId": "dec_approved_01",
    "productId": "working_capital_01",
    "amount": "2000000.00",
    "termMonths": 12,
    "rate": "20.50",
    "monthlyPayment": "186500.00",
    "currency": "RUB",
    "status": "ACTIVE",
    "offerVersion": 1,
    "isAlternative": false,
    "label": null,
    "expiresAt": "2026-11-07T12:00:00Z",
    "createdAt": "2026-10-24T12:00:00Z",
    "conditions": {}
  }
]
```

---

### POST /api/v1/companies/{companyId}/applications/{applicationId}/offers/{offerId}/accept
Принять оффер → nextStep `AGREEMENT_PREPARATION`.

**Аутентификация:** Требуется (write)

**Path параметры:**
- `companyId`, `applicationId`, `offerId` (seed: `offer_approved_01`)

**Headers:**
- `Idempotency-Key` — рекомендуется

**Тело запроса:**
```json
{
  "offerVersion": 1,
  "acceptedTerms": true
}
```

**Ответ (200):**
```json
{
  "applicationId": "app_approved_01",
  "offerId": "offer_approved_01",
  "status": "OFFER_ACCEPTED",
  "nextStep": "AGREEMENT_PREPARATION"
}
```

**Ошибки:**
- `400` — `acceptedTerms: false` (TERMS_NOT_ACCEPTED)
- `404` — оффер не найден
- `409` — невалидный статус оффера / заявки

---

### POST /api/v1/companies/{companyId}/applications/{applicationId}/offers/{offerId}/decline
Отклонить оффер.

**Аутентификация:** Требуется (write)

**Path параметры:**
- `companyId`, `applicationId`, `offerId`

**Тело запроса:**
```json
{
  "reason": "Не устраивает ставка"
}
```

**Ответ (200):** `OfferOut` со `status: "DECLINED"`.

**Ошибки:**
- `404` — оффер не найден
- `400` — нельзя отклонить из текущего статуса

---

### GET /api/v1/companies/{companyId}/applications/{applicationId}/documents
Required slots + загруженные документы (meta).

**Аутентификация:** Требуется (доступ к заявке)

**Path параметры:**
- `companyId`, `applicationId`

**Ответ (200):**
```json
{
  "applicationId": "app_approved_01",
  "required": [
    {
      "docType": "PASSPORT",
      "label": "Паспорт",
      "required": true,
      "status": "UPLOADED",
      "documentId": "doc_..."
    }
  ],
  "documents": [
    {
      "id": "doc_...",
      "docType": "PASSPORT",
      "type": "PASSPORT",
      "name": "passport.pdf",
      "fileName": "passport.pdf",
      "size": 245760,
      "mimeType": "application/pdf",
      "status": "uploaded",
      "uploadedAt": "2026-10-22T11:00:00Z",
      "reviewStatus": null
    }
  ]
}
```

---

### POST /api/v1/companies/{companyId}/applications/{applicationId}/documents
Загрузка файла (`multipart/form-data`).

**Аутентификация:** Требуется (write)

**Path параметры:**
- `companyId`, `applicationId`

**Тело запроса:** `multipart/form-data`
- `file` — файл (обязательно)
- `doc_type` — строка, по умолчанию `OTHER`
- `document_request_id` — опционально, привязка к запросу банка

**Ответ (201):** `DocumentMetaOut`.

**Ошибки:**
- `400` — неверный тип/размер/формат
- `404` — заявка / document_request не найдены

---

### GET /api/v1/companies/{companyId}/applications/{applicationId}/documents/{documentId}
Метаданные документа.

**Аутентификация:** Требуется (доступ к заявке)

**Path параметры:**
- `companyId`, `applicationId`, `documentId`

**Ответ (200):** `DocumentMetaOut`.

**Ошибки:**
- `404` — документ не найден / status `requested`

---

### GET /api/v1/companies/{companyId}/applications/{applicationId}/documents/{documentId}/download
Скачать файл или demo-stub (`text/plain`).

**Аутентификация:** Требуется (доступ к заявке)

**Path параметры:**
- `companyId`, `applicationId`, `documentId`

**Ответ (200):** binary / stub с `Content-Disposition: attachment`

**Ошибки:**
- `404` — документ не найден

---

### GET /api/v1/companies/{companyId}/applications/{applicationId}/document-requests
Запросы документов от банка.

**Аутентификация:** Требуется (доступ к заявке)

**Path параметры:**
- `companyId`, `applicationId` (seed docs: `app_docs_01`)

**Ответ (200):**
```json
[
  {
    "id": "docreq_01",
    "docType": "BUSINESS_PLAN",
    "label": "Бизнес-план",
    "comment": "Нужен краткий план на 12 мес.",
    "status": "OPEN",
    "dueAt": "2026-11-01T00:00:00Z",
    "createdAt": "2026-10-23T10:00:00Z",
    "satisfiedDocumentId": null
  }
]
```

---

### POST /api/v1/companies/{companyId}/applications/{applicationId}/document-requests/{requestId}/respond
Ответ клиента на запрос документов.

**Аутентификация:** Требуется (write)

**Path параметры:**
- `companyId`, `applicationId`, `requestId`

**Тело запроса:**
```json
{
  "documentIds": ["doc_..."],
  "comment": "Бизнес-план загружен"
}
```

**Ответ (200):** `DocumentRequestOut` (обновлённый статус).

**Ошибки:**
- `404` — запрос / документы не найдены
- `400` — нельзя ответить в текущем статусе

---

### GET /api/v1/companies/{companyId}/applications/{applicationId}/agreement
Демо-договор (ensure + serialize).

**Аутентификация:** Требуется (доступ к заявке)

**Path параметры:**
- `companyId`, `applicationId`

**Ответ (200):**
```json
{
  "id": "agr_...",
  "applicationId": "app_approved_01",
  "offerId": "offer_approved_01",
  "companyId": "company_001",
  "number": "DEMO-AGR-001",
  "status": "READY",
  "amount": "2000000.00",
  "termMonths": 12,
  "rate": "20.50",
  "confirmed": false,
  "confirmedAt": null,
  "documentReady": true,
  "disclaimer": "Демонстрационный договор, не имеет юридической силы."
}
```

---

### GET /api/v1/companies/{companyId}/applications/{applicationId}/agreement/download
PDF-stub договора.

**Аутентификация:** Требуется (доступ к заявке)

**Path параметры:**
- `companyId`, `applicationId`

**Ответ (200):** `application/pdf`, `Content-Disposition: attachment; filename="agreement-....pdf"`

---

### POST /api/v1/companies/{companyId}/applications/{applicationId}/agreement/confirm
Демо-подтверждение ознакомления с договором.

**Аутентификация:** Требуется (write)

**Path параметры:**
- `companyId`, `applicationId`

**Тело запроса:**
```json
{
  "acknowledged": true,
  "note": "Ознакомился с условиями"
}
```

**Ответ (200):**
```json
{
  "agreementId": "agr_...",
  "status": "CONFIRMED",
  "confirmedAt": "2026-10-26T08:05:00Z",
  "message": "Демонстрационное ознакомление зафиксировано"
}
```

**Ошибки:**
- `422` — `acknowledged` не true
- `404` — заявка недоступна

---

## Уведомления

Префикс `/api/v1/notifications`. Только свои уведомления текущего пользователя.

### GET /api/v1/notifications
Лента уведомлений.

**Аутентификация:** Требуется

**Query параметры:**
- `unread` — `true` → только непрочитанные
- `type` — фильтр типа (например `APPLICATION_APPROVED`)
- `limit` — 1…100, по умолчанию 50
- `offset` — ≥ 0, по умолчанию 0

**Ответ (200):**
```json
{
  "items": [
    {
      "id": "ntf_ent_01",
      "type": "APPLICATION_APPROVED",
      "title": "Заявка предварительно одобрена",
      "body": "По заявке app_approved_01 доступно предложение offer_approved_01.",
      "channel": "IN_APP",
      "isRead": false,
      "readAt": null,
      "createdAt": "2026-10-24T12:05:00Z",
      "payload": {
        "applicationId": "app_approved_01",
        "offerId": "offer_approved_01"
      }
    },
    {
      "id": "ntf_ent_02",
      "type": "DOCS_REQUESTED",
      "title": "Запрошены документы",
      "body": "По заявке app_docs_01 нужен бизнес-план.",
      "channel": "IN_APP",
      "isRead": false,
      "readAt": null,
      "createdAt": "2026-10-23T10:05:00Z",
      "payload": {
        "applicationId": "app_docs_01",
        "documentRequestId": "docreq_01"
      }
    }
  ],
  "unreadCount": 2,
  "total": 2
}
```

---

### PATCH /api/v1/notifications/{notificationId}
Пометить прочитанным / непрочитанным.

**Аутентификация:** Требуется (только своё)

**Path параметры:**
- `notificationId` — например `ntf_ent_01`

**Тело запроса:**
```json
{
  "isRead": true
}
```

**Ответ (200):**
```json
{
  "id": "ntf_ent_01",
  "type": "APPLICATION_APPROVED",
  "title": "Заявка предварительно одобрена",
  "body": "По заявке app_approved_01 доступно предложение offer_approved_01.",
  "channel": "IN_APP",
  "isRead": true,
  "readAt": "2026-10-26T08:10:00Z",
  "createdAt": "2026-10-24T12:05:00Z",
  "payload": {
    "applicationId": "app_approved_01",
    "offerId": "offer_approved_01"
  }
}
```

**Ошибки:**
- `404` — уведомление не найдено / чужое

---

### POST /api/v1/notifications/read-all
Пометить все уведомления пользователя прочитанными.

**Аутентификация:** Требуется

**Ответ (200):**
```json
{
  "updated": 2
}
```

---

---

## Аналитик

Роль: `ANALYST`. Демо: `analyst@demo.alfa` / `demo1234`.  
Permissions: `applications.review`, `applications.decide`, `companies.read_client`.  
Деньги — десятичные строки в рублях (`"1500000.00"`). JSON — camelCase. Auth: `Authorization: Bearer <accessToken>`.

---

### GET /api/v1/analyst/applications
Очередь заявок для аналитика (без DRAFT). Счётчики по статусам.

**Аутентификация:** Bearer, роль `ANALYST`

**Query параметры:**
- `status` — фильтр статуса (`SUBMITTED`, `IN_REVIEW`, `DOCS_REQUESTED`, …)
- `productId` — id продукта
- `assignedToMe` — только назначенные текущему (`true`/`false`, default `false`)
- `unassigned` — без назначенного аналитика
- `q` — поиск по названию/ИНН/продукту/id
- `includeClosed` — включить `REJECTED`/`ISSUED` (default `false`)
- `limit` — 1…100, default 50
- `offset` — default 0

**Ответ (200 OK):**
```json
{
  "items": [
    {
      "id": "app_01",
      "applicationNumber": "AB-2026-00042",
      "companyId": "cmp_01",
      "companyName": "ООО «Кофе Плюс»",
      "inn": "7701234567",
      "status": "IN_REVIEW",
      "currentStep": "ANALYST_REVIEW",
      "productId": "prd_wc_01",
      "productName": "Оборотный кредит",
      "amount": "1500000.00",
      "termMonths": 12,
      "rate": "18.50",
      "readinessScore": 72,
      "assignedAnalystId": "usr_analyst_01",
      "assignedAnalystName": "Анна Аналитик",
      "openDocumentRequests": 1,
      "submittedAt": "2026-10-20T09:00:00Z",
      "updatedAt": "2026-10-21T11:30:00Z",
      "createdAt": "2026-10-19T14:00:00Z"
    }
  ],
  "total": 1,
  "countsByStatus": {
    "SUBMITTED": 3,
    "IN_REVIEW": 5,
    "DOCS_REQUESTED": 2
  }
}
```

**Ошибки:**
- `401` — нет/протух токен
- `403` — не роль `ANALYST`

---

### POST /api/v1/analyst/applications/{applicationId}/assign
Взять заявку в работу: `assignedAnalyst` + статус `IN_REVIEW`, системный комментарий клиенту.

**Аутентификация:** Bearer, роль `ANALYST`

**Path параметры:**
- `applicationId` — id заявки

**Ответ (200 OK):** карточка `AnalystApplicationCard` (см. GET card ниже).

**Ошибки:**
- `403` — нет прав / чужая заявка без доступа
- `404` — заявка не найдена
- `409` — невалидный переход статуса

---

### GET /api/v1/analyst/applications/{applicationId}
Полная карточка заявки для аналитика: application, company, financials, workflow, checks, doc-requests, decisions, offers, allowedActions.

**Аутентификация:** Bearer, роль `ANALYST`

**Path параметры:**
- `applicationId`

**Ответ (200 OK):**
```json
{
  "application": {
    "id": "app_01",
    "companyId": "cmp_01",
    "productId": "prd_wc_01",
    "productName": "Оборотный кредит",
    "status": "IN_REVIEW",
    "currentStep": "ANALYST_REVIEW",
    "version": 3,
    "amount": "1500000.00",
    "requestedAmount": "1500000.00",
    "termMonths": 12,
    "rate": "18.50",
    "purpose": "Закупка товара",
    "currency": "RUB"
  },
  "company": {
    "id": "cmp_01",
    "inn": "7701234567",
    "name": "ООО «Кофе Плюс»",
    "legalForm": "OOO",
    "ogrn": "1027700132195",
    "industry": "HoReCa",
    "registrationDate": "2021-04-15",
    "region": "Москва",
    "employeesCount": 12,
    "registryStatus": "ACTIVE",
    "version": 1
  },
  "financials": {
    "id": "fs_01",
    "companyId": "cmp_01",
    "period": "2026-Q3",
    "avgMonthlyRevenue": "980000.00",
    "operatingExpenses": "620000.00",
    "cashBalance": "410000.00",
    "liabilities": "250000.00",
    "activeCredits": "180000.00",
    "source": "STATEMENT",
    "confirmed": true,
    "currency": "RUB",
    "updatedAt": "2026-10-18T12:00:00Z"
  },
  "workflow": {
    "id": "wf_01",
    "workflowType": "CREDIT_REVIEW",
    "status": "RUNNING",
    "currentStep": "ANALYST_REVIEW",
    "startedAt": "2026-10-20T09:05:00Z",
    "finishedAt": null,
    "context": {},
    "result": null
  },
  "checksSummary": {
    "total": 6,
    "byStatus": { "PASSED": 4, "WARNING": 1, "FAILED": 1 },
    "byAudience": { "PUBLIC": 4, "INTERNAL": 2 },
    "passed": 4,
    "failed": 1,
    "warnings": 1,
    "internalCount": 2
  },
  "openDocumentRequests": [],
  "decisions": [],
  "offers": [],
  "allowedActions": ["request_documents", "propose", "comment"]
}
```

**Ошибки:**
- `403` / `404`

---

### GET /api/v1/analyst/applications/{applicationId}/checks
Проверки заявки с internal-аудиторией (для банка).

**Аутентификация:** Bearer, роль `ANALYST`

**Path параметры:**
- `applicationId`

**Ответ (200 OK):**
```json
{
  "applicationId": "app_01",
  "status": "IN_REVIEW",
  "summary": {
    "total": 6,
    "byStatus": { "PASSED": 4, "WARNING": 1, "FAILED": 1 },
    "byAudience": { "PUBLIC": 4, "INTERNAL": 2 },
    "passed": 4,
    "failed": 1,
    "warnings": 1,
    "internalCount": 2
  },
  "checks": [
    {
      "id": "chk_01",
      "checkKey": "DEBT_LOAD",
      "status": "WARNING",
      "score": 62,
      "reasonCodes": ["DEBT_LOAD_ELEVATED"],
      "explanation": "Долговая нагрузка выше комфортного порога",
      "createdAt": "2026-10-20T09:06:00Z",
      "audience": "INTERNAL",
      "workflowId": "wf_01",
      "payload": { "ratio": "0.42" }
    }
  ]
}
```

**Ошибки:**
- `404` — заявка не найдена

---

### GET /api/v1/analyst/applications/{applicationId}/document-requests
Список запросов документов (все статусы, свежие сверху).

**Аутентификация:** Bearer, роль `ANALYST`

**Path параметры:**
- `applicationId`

**Ответ (200 OK):**
```json
[
  {
    "id": "dr_01",
    "docType": "BANK_STATEMENT",
    "label": "Выписка за 6 месяцев",
    "comment": "Нужна актуальная выписка",
    "status": "OPEN",
    "dueAt": "2026-10-28T00:00:00Z",
    "createdAt": "2026-10-21T10:00:00Z",
    "satisfiedDocumentId": null
  }
]
```

**Ошибки:**
- `404`

---

### POST /api/v1/analyst/applications/{applicationId}/document-requests
Создать запрос документа → статус заявки `DOCS_REQUESTED`. **201**.

**Аутентификация:** Bearer, роль `ANALYST` (write access)

**Path параметры:**
- `applicationId`

**Тело запроса:**
```json
{
  "docType": "TAX_DECLARATION",
  "comment": "Предоставьте декларацию УСН за последний год",
  "dueAt": "2026-11-01T00:00:00Z"
}
```

**Ответ (201 Created):**
```json
{
  "request": {
    "id": "dr_02",
    "docType": "TAX_DECLARATION",
    "label": null,
    "comment": "Предоставьте декларацию УСН за последний год",
    "status": "OPEN",
    "dueAt": "2026-11-01T00:00:00Z",
    "createdAt": "2026-10-21T12:00:00Z",
    "satisfiedDocumentId": null
  },
  "applicationId": "app_01",
  "status": "DOCS_REQUESTED",
  "currentStep": "WAITING_DOCUMENTS"
}
```

**Ошибки:**
- `403` / `404` / `422`

---

### POST /api/v1/analyst/applications/{applicationId}/document-requests/{requestId}/cancel
Отменить открытый запрос документов.

**Аутентификация:** Bearer, роль `ANALYST` (write)

**Path параметры:**
- `applicationId`, `requestId`

**Тело запроса:**
```json
{
  "reason": "Документ больше не требуется"
}
```

**Ответ (200 OK):**
```json
{
  "request": {
    "id": "dr_02",
    "docType": "TAX_DECLARATION",
    "label": null,
    "comment": "Предоставьте декларацию УСН за последний год",
    "status": "CANCELLED",
    "dueAt": "2026-11-01T00:00:00Z",
    "createdAt": "2026-10-21T12:00:00Z",
    "satisfiedDocumentId": null
  },
  "applicationId": "app_01",
  "status": "IN_REVIEW",
  "currentStep": "ANALYST_REVIEW"
}
```

**Ошибки:**
- `404` — заявка/запрос не найден
- `409` — запрос уже закрыт

---

### GET /api/v1/analyst/applications/{applicationId}/comments
Все комментарии, **включая** `isInternal: true`.

**Аутентификация:** Bearer, роль `ANALYST`

**Path параметры:**
- `applicationId`

**Ответ (200 OK):**
```json
[
  {
    "id": "cmt_01",
    "authorId": "usr_analyst_01",
    "authorName": "Анна Аналитик",
    "authorRole": "ANALYST",
    "text": "Проверить сезонность выручки",
    "createdAt": "2026-10-21T11:00:00Z",
    "isInternal": true
  }
]
```

**Ошибки:**
- `404`

---

### POST /api/v1/analyst/applications/{applicationId}/comments
Сообщение клиенту (`isInternal: false` → notify) или внутренняя заметка. **201**.

**Аутентификация:** Bearer, роль `ANALYST` (write)

**Path параметры:**
- `applicationId`

**Тело запроса:**
```json
{
  "text": "Пожалуйста, загрузите выписку за сентябрь",
  "isInternal": false
}
```

**Ответ (201 Created):**
```json
{
  "id": "cmt_02",
  "authorId": "usr_analyst_01",
  "authorName": "Анна Аналитик",
  "authorRole": "ANALYST",
  "text": "Пожалуйста, загрузите выписку за сентябрь",
  "createdAt": "2026-10-21T12:15:00Z",
  "isInternal": false
}
```

**Ошибки:**
- `422` — пустой текст
- `403` / `404`

---

### POST /api/v1/analyst/applications/{applicationId}/propose
Предложить решение: `APPROVED` | `REJECTED` | `COUNTEROFFERED` | `NEED_INFO`. Для approve/counter — параметры оффера (Money-строки).

**Аутентификация:** Bearer, роль `ANALYST` (write); permission `applications.decide`

**Path параметры:**
- `applicationId`

**Тело запроса:**
```json
{
  "decision": "COUNTEROFFERED",
  "reasonCodes": ["AMOUNT_ADJUSTED"],
  "explanation": "Можем одобрить меньшую сумму при текущей долговой нагрузке",
  "comment": "Внутренний комментарий к решению",
  "offerAmount": "1200000.00",
  "offerTermMonths": 12,
  "offerRate": "19.00",
  "productId": "prd_wc_01",
  "offerLabel": "Контрпредложение по оборотному"
}
```

**Ответ (200 OK):**
```json
{
  "applicationId": "app_01",
  "status": "COUNTEROFFERED",
  "currentStep": "CLIENT_OFFER_REVIEW",
  "decisionId": "dec_01",
  "decisionType": "COUNTEROFFERED",
  "offerId": "off_01",
  "reasonCodes": ["AMOUNT_ADJUSTED"],
  "explanation": "Можем одобрить меньшую сумму при текущей долговой нагрузке",
  "offer": {
    "id": "off_01",
    "amount": "1200000.00",
    "termMonths": 12,
    "rate": "19.00",
    "monthlyPayment": "110850.00",
    "status": "PENDING",
    "expiresAt": "2026-11-04T00:00:00Z",
    "conditions": {}
  }
}
```

**Ошибки:**
- `409` — `INVALID_TRANSITION` (не из SUBMITTED/VALIDATING/IN_REVIEW/DOCS_REQUESTED/COUNTEROFFERED/APPROVED)
- `422` — нет обязательных полей оффера
- `403` / `404`

---

## Админ

Роль: `ADMIN`. Демо: `admin@demo.alfa` / `demo1234`.  
Клиентские `/companies/*` для ADMIN → **403** («работайте через `/admin/*`»).  
Permissions: `users.manage`, `catalog.manage`, `policy.edit`, `policy.publish`, `models.manage`, `demo.reset`, `analytics.read`, `audit.read`.

---

### GET /api/v1/admin/roles
Каталог ролей и дефолтных permissions.

**Аутентификация:** Bearer, роль `ADMIN`

**Ответ (200 OK):**
```json
[
  {
    "role": "ANALYST",
    "title": "Кредитный аналитик",
    "description": "Очередь заявок, решения, запросы документов",
    "permissions": ["applications.review", "applications.decide", "companies.read_client"]
  },
  {
    "role": "ADMIN",
    "title": "Администратор",
    "description": "Пользователи, каталог, политики, модели, демо, аудит",
    "permissions": [
      "users.manage",
      "catalog.manage",
      "policy.edit",
      "policy.publish",
      "models.manage",
      "demo.reset",
      "analytics.read",
      "audit.read"
    ]
  }
]
```

**Ошибки:**
- `403`

---

### GET /api/v1/admin/permissions
Каталог permission-кодов.

**Аутентификация:** Bearer, роль `ADMIN`

**Ответ (200 OK):**
```json
[
  { "code": "users.manage", "title": "Управление пользователями" },
  { "code": "catalog.manage", "title": "Каталог кредитных продуктов" },
  { "code": "policy.edit", "title": "Редактирование политик" },
  { "code": "policy.publish", "title": "Публикация политик" },
  { "code": "models.manage", "title": "ML/AI модели и runtime" },
  { "code": "demo.reset", "title": "Демо-сценарии и reset" },
  { "code": "analytics.read", "title": "Аналитика" },
  { "code": "audit.read", "title": "Аудит-события" }
]
```

**Ошибки:**
- `403`

---

### GET /api/v1/admin/users
Список пользователей. Permission: `users.manage`.

**Аутентификация:** Bearer, `ADMIN` + `users.manage`

**Query параметры:**
- `role` — `ENTREPRENEUR` | `ANALYST` | `ADMIN`
- `status` — `ACTIVE` | `DISABLED` | …
- `q` — поиск
- `limit` / `offset`

**Ответ (200 OK):**
```json
{
  "items": [
    {
      "id": "usr_analyst_01",
      "login": "analyst@demo.alfa",
      "email": "analyst@demo.alfa",
      "phone": null,
      "fullName": "Анна Аналитик",
      "role": "ANALYST",
      "status": "ACTIVE",
      "isActive": true,
      "permissions": ["applications.review", "applications.decide", "companies.read_client"],
      "companyIds": [],
      "lastLoginAt": "2026-10-25T08:00:00Z",
      "createdAt": "2026-10-01T00:00:00Z"
    }
  ],
  "total": 1
}
```

**Ошибки:**
- `403`

---

### POST /api/v1/admin/users
Создать пользователя. **201**. Permission: `users.manage`.

**Аутентификация:** Bearer, `ADMIN` + `users.manage`

**Тело запроса:**
```json
{
  "login": "new.analyst@demo.alfa",
  "email": "new.analyst@demo.alfa",
  "phone": "+79001234567",
  "password": "demo1234",
  "fullName": "Иван Новый",
  "role": "ANALYST",
  "status": "ACTIVE"
}
```

**Ответ (201 Created):** объект `AdminUserOut` (пароль не возвращается).

**Ошибки:**
- `409` — login занят
- `422` / `403`

---

### GET /api/v1/admin/users/{userId}
Карточка пользователя. Permission: `users.manage`.

**Аутентификация:** Bearer, `ADMIN` + `users.manage`

**Path параметры:**
- `userId`

**Ответ (200 OK):** `AdminUserOut` (см. список).

**Ошибки:**
- `404` / `403`

---

### PATCH /api/v1/admin/users/{userId}
Патч профиля/роли/статуса. Нельзя снять с себя `ADMIN` / disable себя. Permission: `users.manage`.

**Аутентификация:** Bearer, `ADMIN` + `users.manage`

**Path параметры:**
- `userId`

**Тело запроса:**
```json
{
  "fullName": "Анна Аналитик (старший)",
  "role": "ANALYST",
  "status": "ACTIVE",
  "isActive": true
}
```

**Ответ (200 OK):** `AdminUserOut`

**Ошибки:**
- `409` — попытка снять с себя ADMIN / отключить себя
- `404` / `403`

---

### POST /api/v1/admin/users/{userId}/disable
Disable + revoke sessions. Permission: `users.manage`.

**Аутентификация:** Bearer, `ADMIN` + `users.manage`

**Path параметры:**
- `userId`

**Ответ (200 OK):**
```json
{
  "userId": "usr_01",
  "status": "DISABLED",
  "isActive": false,
  "sessionsRevoked": 2
}
```

**Ошибки:**
- `404` / `403`

---

### POST /api/v1/admin/users/{userId}/reset-credentials
Сброс пароля (demo). Сессии отзываются. Permission: `users.manage`.

**Аутентификация:** Bearer, `ADMIN` + `users.manage`

**Path параметры:**
- `userId`

**Тело запроса:**
```json
{
  "password": "demo1234"
}
```

**Ответ (200 OK):**
```json
{
  "userId": "usr_01",
  "message": "Учётные данные обновлены, сессии отозваны"
}
```

**Ошибки:**
- `404` / `403` / `422`

---

### GET /api/v1/admin/companies
Все компании платформы. Permission: `users.manage`.

**Аутентификация:** Bearer, `ADMIN` + `users.manage`

**Query параметры:**
- `q`, `limit`, `offset`

**Ответ (200 OK):**
```json
{
  "items": [
    {
      "id": "cmp_01",
      "inn": "7701234567",
      "name": "ООО «Кофе Плюс»",
      "legalForm": "OOO",
      "registryStatus": "ACTIVE",
      "region": "Москва",
      "membersCount": 2
    }
  ],
  "total": 1
}
```

**Ошибки:**
- `403`

---

### GET /api/v1/admin/companies/{companyId}/members
Участники компании. Permission: `users.manage`.

**Аутентификация:** Bearer, `ADMIN` + `users.manage`

**Path параметры:**
- `companyId`

**Ответ (200 OK):**
```json
[
  {
    "userId": "usr_ent_01",
    "companyId": "cmp_01",
    "role": "OWNER",
    "fullName": "Алексей Петров",
    "email": "entrepreneur@demo.alfa",
    "login": "entrepreneur@demo.alfa",
    "userRole": "ENTREPRENEUR",
    "permissions": {},
    "createdAt": "2026-10-01T00:00:00Z"
  }
]
```

**Ошибки:**
- `403`

---

### PUT /api/v1/admin/companies/{companyId}/members/{userId}
Upsert membership. Permission: `users.manage`.

**Аутентификация:** Bearer, `ADMIN` + `users.manage`

**Path параметры:**
- `companyId`, `userId`

**Тело запроса:**
```json
{
  "role": "MEMBER",
  "permissions": { "write": true }
}
```

**Ответ (200 OK):** `AdminMemberOut`

**Ошибки:**
- `404` — пользователь/компания
- `403`

---

### DELETE /api/v1/admin/companies/{companyId}/members/{userId}
Убрать участника. **204**. Permission: `users.manage`.

**Аутентификация:** Bearer, `ADMIN` + `users.manage`

**Path параметры:**
- `companyId`, `userId`

**Ответ (204 No Content):** пусто

**Ошибки:**
- `404` / `403`

---

### GET /api/v1/admin/credit-products
Каталог продуктов (все статусы). Permission: `catalog.manage`.

**Аутентификация:** Bearer, `ADMIN` + `catalog.manage`

**Query параметры:**
- `status` — `DRAFT` | `PUBLISHED` | `ARCHIVED`
- `type` — `working_capital` | `investment` | `overdraft` | `credit_line`
- `q`, `limit`, `offset`

**Ответ (200 OK):**
```json
{
  "items": [
    {
      "id": "prd_wc_01",
      "code": "WC_STD",
      "name": "Оборотный кредит",
      "type": "working_capital",
      "description": "Финансирование оборотных средств",
      "amountMin": "300000.00",
      "amountMax": "5000000.00",
      "termMin": 3,
      "termMax": 36,
      "rateMin": "16.00",
      "rateMax": "24.00",
      "annualRatePercent": "18.50",
      "currency": "RUB",
      "collateralRequired": false,
      "legalForms": ["IP", "OOO"],
      "minBusinessAgeMonths": 6,
      "suitableGoals": ["inventory_purchase", "cash_gap"],
      "documents": ["BANK_STATEMENT"],
      "fees": [],
      "scheduleTypes": ["ANNUITY"],
      "features": [],
      "eligibilityRules": {},
      "requirements": {},
      "rules": [],
      "status": "PUBLISHED",
      "version": 2,
      "isActive": true,
      "versions": []
    }
  ],
  "total": 1
}
```

**Ошибки:**
- `403`

---

### POST /api/v1/admin/credit-products
Создать продукт в `DRAFT`. **201**. Permission: `catalog.manage`.

**Аутентификация:** Bearer, `ADMIN` + `catalog.manage`

**Тело запроса:**
```json
{
  "code": "WC_NEW",
  "name": "Оборотный экспресс",
  "type": "working_capital",
  "description": "Короткий оборотный",
  "amountMin": "200000.00",
  "amountMax": "3000000.00",
  "termMin": 3,
  "termMax": 24,
  "rateMin": "17.00",
  "rateMax": "22.00",
  "annualRatePercent": "19.00",
  "currency": "RUB",
  "collateralRequired": false,
  "legalForms": ["OOO", "IP"],
  "minBusinessAgeMonths": 3,
  "suitableGoals": ["inventory_purchase"],
  "documents": ["BANK_STATEMENT"],
  "scheduleTypes": ["ANNUITY"]
}
```

**Ответ (201 Created):** `AdminCreditProductOut` со `status: "DRAFT"`, `version: 1`.

**Ошибки:**
- `422` / `403`

---

### GET /api/v1/admin/credit-products/{productId}
Карточка + versions. Permission: `catalog.manage`.

**Аутентификация:** Bearer, `ADMIN` + `catalog.manage`

**Path параметры:**
- `productId`

**Ответ (200 OK):** `AdminCreditProductOut` с массивом `versions`.

**Ошибки:**
- `404` / `403`

---

### PATCH /api/v1/admin/credit-products/{productId}
Патч черновика/полей продукта. Permission: `catalog.manage`.

**Аутентификация:** Bearer, `ADMIN` + `catalog.manage`

**Path параметры:**
- `productId`

**Тело запроса:**
```json
{
  "amountMax": "6000000.00",
  "rateMax": "23.00",
  "description": "Обновлённое описание"
}
```

**Ответ (200 OK):** `AdminCreditProductOut`

**Ошибки:**
- `404` / `403` / `422`

---

### POST /api/v1/admin/credit-products/{productId}/publish
Опубликовать продукт (+ changelog, version++). Permission: `catalog.manage`.

**Аутентификация:** Bearer, `ADMIN` + `catalog.manage`

**Path параметры:**
- `productId`

**Тело запроса:**
```json
{
  "changelog": "Расширен лимит до 6 млн"
}
```

**Ответ (200 OK):** `AdminCreditProductOut` со `status: "PUBLISHED"`.

**Ошибки:**
- `404` / `403` / `409`

---

### POST /api/v1/admin/credit-products/{productId}/archive
Архивировать продукт. Permission: `catalog.manage`.

**Аутентификация:** Bearer, `ADMIN` + `catalog.manage`

**Path параметры:**
- `productId`

**Ответ (200 OK):** `AdminCreditProductOut` со `status: "ARCHIVED"`.

**Ошибки:**
- `404` / `403`

---

### GET /api/v1/admin/credit-products/{productId}/versions
История версий продукта. Permission: `catalog.manage`.

**Аутентификация:** Bearer, `ADMIN` + `catalog.manage`

**Path параметры:**
- `productId`

**Ответ (200 OK):**
```json
[
  {
    "id": "pv_02",
    "productId": "prd_wc_01",
    "version": 2,
    "changelog": "Расширен лимит до 6 млн",
    "createdBy": "usr_admin_01",
    "createdAt": "2026-10-22T10:00:00Z",
    "snapshot": { "amountMax": "6000000.00" }
  }
]
```

**Ошибки:**
- `403`

---

### GET /api/v1/admin/policies
Список кредитных политик. Permission: `policy.edit`.

**Аутентификация:** Bearer, `ADMIN` + `policy.edit`

**Query параметры:**
- `status`, `q`, `limit`, `offset`

**Ответ (200 OK):**
```json
{
  "items": [
    {
      "id": "pol_01",
      "code": "BASE_SCORING",
      "name": "Базовая политика скоринга",
      "description": "Пороги долговой нагрузки и возраста бизнеса",
      "status": "PUBLISHED",
      "version": 3,
      "rules": { "maxDebtLoad": "0.45", "minBusinessAgeMonths": 6 },
      "parameterSource": "SYNTHETIC_DSL",
      "createdBy": "usr_admin_01",
      "publishedAt": "2026-10-15T12:00:00Z",
      "versions": []
    }
  ],
  "total": 1
}
```

**Ошибки:**
- `403`

---

### POST /api/v1/admin/policies
Создать политику. **201**. Permission: `policy.edit`.

**Аутентификация:** Bearer, `ADMIN` + `policy.edit`

**Тело запроса:**
```json
{
  "code": "STRESS_V1",
  "name": "Стресс-правила",
  "description": "Жёстче пороги для HoReCa",
  "rules": { "maxDebtLoad": "0.35", "sectorHaircut": { "HoReCa": "0.10" } }
}
```

**Ответ (201 Created):** `AdminPolicyOut` (`DRAFT`).

**Ошибки:**
- `409` — code занят
- `422` / `403`

---

### GET /api/v1/admin/policies/{policyId}
Карточка + versions. Permission: `policy.edit`.

**Аутентификация:** Bearer, `ADMIN` + `policy.edit`

**Path параметры:**
- `policyId`

**Ответ (200 OK):** `AdminPolicyOut`

**Ошибки:**
- `404` / `403`

---

### PATCH /api/v1/admin/policies/{policyId}
Патч meta/rules. Permission: `policy.edit`.

**Аутентификация:** Bearer, `ADMIN` + `policy.edit`

**Path параметры:**
- `policyId`

**Тело запроса:**
```json
{
  "name": "Стресс-правила v2",
  "rules": { "maxDebtLoad": "0.33" }
}
```

**Ответ (200 OK):** `AdminPolicyOut`

**Ошибки:**
- `404` / `403`

---

### GET /api/v1/admin/policies/{policyId}/versions
Версии политики. Permission: `policy.edit`.

**Аутентификация:** Bearer, `ADMIN` + `policy.edit`

**Path параметры:**
- `policyId`

**Ответ (200 OK):**
```json
[
  {
    "id": "pov_03",
    "policyId": "pol_01",
    "version": 3,
    "rules": { "maxDebtLoad": "0.45" },
    "changelog": "Смягчён порог",
    "createdBy": "usr_admin_01",
    "createdAt": "2026-10-15T12:00:00Z"
  }
]
```

**Ошибки:**
- `403`

---

### POST /api/v1/admin/policies/{policyId}/validate
Валидация rules DSL. Permission: `policy.edit`.

**Аутентификация:** Bearer, `ADMIN` + `policy.edit`

**Path параметры:**
- `policyId`

**Ответ (200 OK):**
```json
{
  "valid": true,
  "errors": [],
  "warnings": [{ "field": "sectorHaircut", "code": "UNUSED_KEY" }],
  "allowedKeys": ["maxDebtLoad", "minBusinessAgeMonths", "sectorHaircut"]
}
```

**Ошибки:**
- `404` / `403`

---

### POST /api/v1/admin/policies/{policyId}/simulate
Асинхронная симуляция на демо-сценариях. **202**. Permission: `policy.edit`.

**Аутентификация:** Bearer, `ADMIN` + `policy.edit`

**Path параметры:**
- `policyId`

**Тело запроса:**
```json
{
  "draftVersion": 4,
  "scenarioIds": ["demo_sc_01", "demo_sc_02"],
  "compareWithPublished": true
}
```

**Ответ (202 Accepted):**
```json
{
  "runId": "sim_01",
  "status": "QUEUED"
}
```

**Ошибки:**
- `404` / `403`

---

### GET /api/v1/admin/policies/{policyId}/simulations/{runId}
Результат симуляции. Permission: `policy.edit`.

**Аутентификация:** Bearer, `ADMIN` + `policy.edit`

**Path параметры:**
- `policyId`, `runId`

**Ответ (200 OK):**
```json
{
  "runId": "sim_01",
  "status": "COMPLETED",
  "policyDraftVersion": 4,
  "policyId": "pol_01",
  "results": [
    { "scenarioId": "demo_sc_01", "decision": "APPROVED", "deltaVsPublished": "SAME" }
  ],
  "isMock": true,
  "note": "Демо-симуляция на синтетических сценариях",
  "input": { "compareWithPublished": true },
  "createdAt": "2026-10-22T11:00:00Z"
}
```

**Ошибки:**
- `404` / `403`

---

### POST /api/v1/admin/policies/{policyId}/publish
Опубликовать политику. Permission: `policy.publish`.

**Аутентификация:** Bearer, `ADMIN` + `policy.publish`

**Path параметры:**
- `policyId`

**Тело запроса:**
```json
{
  "changelog": "Порог maxDebtLoad 0.45"
}
```

**Ответ (200 OK):** `AdminPolicyOut` со `status: "PUBLISHED"`.

**Ошибки:**
- `404` / `403` / `409`

---

### GET /api/v1/admin/policies/{policyId}/diff
Diff двух версий. Permission: `policy.edit`.

**Аутентификация:** Bearer, `ADMIN` + `policy.edit`

**Path параметры:**
- `policyId`

**Query параметры:**
- `from` — версия-источник
- `to` — версия-цель

**Ответ (200 OK):**
```json
{
  "policyId": "pol_01",
  "fromVersion": 2,
  "toVersion": 3,
  "added": {},
  "removed": {},
  "changed": { "maxDebtLoad": { "from": "0.40", "to": "0.45" } }
}
```

**Ошибки:**
- `404` / `403`

---

### GET /api/v1/admin/models
Реестр ML/AI моделей. Permission: `models.manage`.

**Аутентификация:** Bearer, `ADMIN` + `models.manage`

**Query параметры:**
- `task` — фильтр задачи (`credit_explanation`, `product_selection`, …)

**Ответ (200 OK):**
```json
[
  {
    "id": "mdl_01",
    "name": "credit-explainer",
    "version": "1.2.0",
    "task": "credit_explanation",
    "status": "READY",
    "endpoint": null,
    "metrics": { "latencyP95Ms": 180 },
    "inputSchema": {},
    "outputSchema": {},
    "artifact": "local://models/credit-explainer-1.2.0",
    "resources": { "gpu": false },
    "fallback": "RULES_TEMPLATE",
    "paramsBillion": null,
    "isActive": true,
    "meta": {},
    "evaluations": [],
    "createdAt": "2026-09-01T00:00:00Z",
    "updatedAt": "2026-10-10T00:00:00Z"
  }
]
```

**Ошибки:**
- `403`

---

### GET /api/v1/admin/models/active
Активные модели по task. Permission: `models.manage`.

**Аутентификация:** Bearer, `ADMIN` + `models.manage`

**Ответ (200 OK):**
```json
[
  {
    "task": "credit_explanation",
    "modelId": "mdl_01",
    "name": "credit-explainer",
    "version": "1.2.0",
    "status": "ACTIVE",
    "activatedBy": "usr_admin_01",
    "activatedAt": "2026-10-10T00:00:00Z",
    "fallback": "RULES_TEMPLATE"
  }
]
```

**Ошибки:**
- `403`

---

### GET /api/v1/admin/models/evaluations
Все оценки моделей. Permission: `models.manage`.

**Аутентификация:** Bearer, `ADMIN` + `models.manage`

**Ответ (200 OK):**
```json
[
  {
    "id": "eval_01",
    "modelId": "mdl_01",
    "dataset": "demo_holdout_v1",
    "metrics": { "groundingPassRate": 0.91 },
    "notes": "Ок для демо",
    "createdBy": "usr_admin_01",
    "createdAt": "2026-10-09T00:00:00Z",
    "modelName": "credit-explainer",
    "modelVersion": "1.2.0",
    "task": "credit_explanation",
    "baseline": 0.85
  }
]
```

**Ошибки:**
- `403`

---

### GET /api/v1/admin/models/{modelId}
Карточка модели (+ evaluations). Permission: `models.manage`.

**Аутентификация:** Bearer, `ADMIN` + `models.manage`

**Path параметры:**
- `modelId`

**Ответ (200 OK):** `AdminModelOut`

**Ошибки:**
- `404` / `403`

---

### POST /api/v1/admin/models/{modelId}/validate
Проверка совместимости/health. Permission: `models.manage`.

**Аутентификация:** Bearer, `ADMIN` + `models.manage`

**Path параметры:**
- `modelId`

**Ответ (200 OK):**
```json
{
  "modelId": "mdl_01",
  "compatible": true,
  "health": { "ok": true },
  "errors": [],
  "warnings": [],
  "contract": { "promptVersion": "credit-explanations-v1" }
}
```

**Ошибки:**
- `404` / `403`

---

### POST /api/v1/admin/models/{modelId}/activate
Активировать модель на task. Permission: `models.manage`.

**Аутентификация:** Bearer, `ADMIN` + `models.manage`

**Path параметры:**
- `modelId`

**Тело запроса:**
```json
{
  "task": "credit_explanation",
  "expectedModelVersion": "1.2.0",
  "reason": "Стабильные метрики на holdout"
}
```

**Ответ (200 OK):**
```json
{
  "modelId": "mdl_01",
  "task": "credit_explanation",
  "status": "ACTIVE",
  "version": "1.2.0",
  "reason": "Стабильные метрики на holdout",
  "activationId": "act_01",
  "activatedAt": "2026-10-22T12:00:00Z",
  "activatedBy": "usr_admin_01",
  "validation": { "compatible": true }
}
```

**Ошибки:**
- `404` / `403` / `409` — version mismatch

---

### GET /api/v1/admin/models/{modelId}/evaluations
Оценки конкретной модели. Permission: `models.manage`.

**Аутентификация:** Bearer, `ADMIN` + `models.manage`

**Path параметры:**
- `modelId`

**Ответ (200 OK):** список `AdminModelEvaluationOut` (см. выше).

**Ошибки:**
- `404` / `403`

---

### GET /api/v1/admin/config/runtime
Runtime-флаги (whitelist). Permission: `models.manage`.

**Аутентификация:** Bearer, `ADMIN` + `models.manage`

**Ответ (200 OK):**
```json
{
  "parameters": {
    "llmEnabled": false,
    "maxTokens": 1024,
    "temperature": 0.2
  },
  "whitelist": ["llmEnabled", "maxTokens", "temperature"],
  "note": "Только ключи из whitelist принимаются PATCH",
  "applied": {},
  "rejected": []
}
```

**Ошибки:**
- `403`

---

### PATCH /api/v1/admin/config/runtime
Патч runtime parameters (только whitelist). Permission: `models.manage`.

**Аутентификация:** Bearer, `ADMIN` + `models.manage`

**Тело запроса:**
```json
{
  "parameters": {
    "llmEnabled": true,
    "maxTokens": 1536
  }
}
```

**Ответ (200 OK):**
```json
{
  "parameters": {
    "llmEnabled": true,
    "maxTokens": 1536,
    "temperature": 0.2
  },
  "whitelist": ["llmEnabled", "maxTokens", "temperature"],
  "note": null,
  "applied": { "llmEnabled": true, "maxTokens": 1536 },
  "rejected": []
}
```

**Ошибки:**
- `403`

---

### GET /api/v1/admin/demo/scenarios
Список демо-сценариев. Permission: `demo.reset`.

**Аутентификация:** Bearer, `ADMIN` + `demo.reset`

**Ответ (200 OK):**
```json
[
  {
    "id": "dsc_01",
    "code": "HAPPY_APPROVE",
    "title": "Одобрение по оборотному",
    "description": "Сильная компания, чистая выписка",
    "persona": "ENTREPRENEUR",
    "seedVersion": "2026.10",
    "seedPayload": {},
    "companyId": "cmp_01",
    "applicationId": "app_seed_01",
    "expectedStatus": "APPROVED",
    "expectedDecision": "APPROVED",
    "expectedOfferId": null,
    "createdAt": "2026-10-01T00:00:00Z"
  }
]
```

**Ошибки:**
- `403`

---

### GET /api/v1/admin/demo/scenarios/{scenarioId}
Один демо-сценарий. Permission: `demo.reset`.

**Аутентификация:** Bearer, `ADMIN` + `demo.reset`

**Path параметры:**
- `scenarioId`

**Ответ (200 OK):** `AdminDemoScenarioOut`

**Ошибки:**
- `404` / `403`

---

### POST /api/v1/admin/demo/scenarios/{scenarioId}/load
Подгрузить сценарий (async job). **202**. Permission: `demo.reset`.  
Рекомендуется header `Idempotency-Key`.

**Аутентификация:** Bearer, `ADMIN` + `demo.reset`

**Path параметры:**
- `scenarioId`

**Ответ (202 Accepted):**
```json
{
  "id": "job_01",
  "jobId": "job_01",
  "scenarioId": "dsc_01",
  "jobType": "LOAD_SCENARIO",
  "status": "QUEUED",
  "requestedBy": "usr_admin_01",
  "result": {},
  "errorMessage": null,
  "startedAt": null,
  "finishedAt": null,
  "createdAt": "2026-10-22T13:00:00Z"
}
```

**Ошибки:**
- `404` / `403`

---

### POST /api/v1/admin/demo/reset
Wipe + reseed workspace. **202**. Permission: `demo.reset`. Осторожно: уничтожает демоданные.

**Аутентификация:** Bearer, `ADMIN` + `demo.reset`

**Headers:**
- `Idempotency-Key` — рекомендуется

**Тело запроса:**
```json
{
  "workspace": "demo",
  "confirmPhrase": "RESET DEMO NOW",
  "seedVersion": "2026.10"
}
```

**Ответ (202 Accepted):** `AdminDemoJobOut` с `jobType: "RESET"`.

**Ошибки:**
- `422` — неверная `confirmPhrase`
- `403`

---

### GET /api/v1/admin/demo/jobs/{jobId}
Статус demo job. Permission: `demo.reset`.

**Аутентификация:** Bearer, `ADMIN` + `demo.reset`

**Path параметры:**
- `jobId`

**Ответ (200 OK):** `AdminDemoJobOut` (`QUEUED` | `RUNNING` | `COMPLETED` | `FAILED`).

**Ошибки:**
- `404` / `403`

---

### GET /api/v1/admin/audit/events
Лента аудита (секреты в details маскируются `***`). Permission: `audit.read`.

**Аутентификация:** Bearer, `ADMIN` + `audit.read`

**Query параметры:**
- `action`, `entityType`, `actorId`, `q`, `limit` (≤200), `offset`

**Ответ (200 OK):**
```json
{
  "items": [
    {
      "id": "aud_01",
      "actorId": "usr_admin_01",
      "actorLogin": "admin@demo.alfa",
      "actorRole": "ADMIN",
      "action": "admin_publish",
      "entityType": "credit_product",
      "entityId": "prd_wc_01",
      "companyId": null,
      "correlationId": "req_01JABC",
      "details": { "version": "2" },
      "createdAt": "2026-10-22T10:00:05Z"
    }
  ],
  "total": 1
}
```

**Ошибки:**
- `403`

---

### GET /api/v1/admin/audit/events/{eventId}
Одно audit-событие. Permission: `audit.read`.

**Аутентификация:** Bearer, `ADMIN` + `audit.read`

**Path параметры:**
- `eventId`

**Ответ (200 OK):** `AuditEventOut`

**Ошибки:**
- `404` / `403`

---

## Финансы, выписки, прогнозы

Company-scoped. Доступ: `ENTREPRENEUR` (write на мутациях), `ANALYST` (read при доступе к компании). Деньги — строки. Period: `6m` / `12m` и т.п.

---

### GET /api/v1/companies/{companyId}/statements
Список загруженных выписок.

**Аутентификация:** Bearer, доступ к компании

**Path параметры:**
- `companyId`

**Ответ (200 OK):**
```json
[
  {
    "id": "st_01",
    "companyId": "cmp_01",
    "periodFrom": "2026-04-01",
    "periodTo": "2026-09-30",
    "sourceType": "UPLOAD",
    "sourceLabel": "Расчётный счёт Альфа",
    "fileName": "statement_h1.csv",
    "status": "CONFIRMED",
    "processingStatus": "CONFIRMED",
    "txCount": 248,
    "errorMessage": null,
    "uploadedAt": "2026-10-10T09:00:00Z",
    "processedAt": "2026-10-10T09:00:02Z"
  }
]
```

**Ошибки:**
- `404` — нет доступа/компании (tenant-safe)

---

### POST /api/v1/companies/{companyId}/statements
Загрузка CSV/XLSX. **202**. Multipart. Лимит — `max_upload_mb` → иначе **413**.

**Аутентификация:** Bearer, write-доступ к компании

**Path параметры:**
- `companyId`

**Тело запроса:** `multipart/form-data`
- `file` — файл (обязательно)
- `period_start` — дата (опц.)
- `period_end` — дата (опц.)
- `source_label` — строка (опц.)

**Ответ (202 Accepted):**
```json
{
  "statementId": "st_02",
  "id": "st_02",
  "processingStatus": "PARSED"
}
```

**Ошибки:**
- `413` — файл слишком большой
- `403` / `404` / `422`

---

### GET /api/v1/companies/{companyId}/statements/{statementId}
Детали выписки + parsing summary / errors / structure.

**Аутентификация:** Bearer, доступ к компании

**Path параметры:**
- `companyId`, `statementId`

**Ответ (200 OK):**
```json
{
  "id": "st_02",
  "companyId": "cmp_01",
  "periodFrom": "2026-04-01",
  "periodTo": "2026-09-30",
  "sourceType": "UPLOAD",
  "sourceLabel": "Расчётный счёт Альфа",
  "fileName": "statement_h1.csv",
  "status": "PARSED",
  "processingStatus": "PARSED",
  "txCount": 248,
  "errorMessage": null,
  "uploadedAt": "2026-10-10T09:00:00Z",
  "processedAt": "2026-10-10T09:00:02Z",
  "parsedSummary": {
    "inflow": "5200000.00",
    "outflow": "4800000.00",
    "currency": "RUB"
  },
  "errors": [],
  "structure": { "columns": ["date", "amount", "purpose"] }
}
```

**Ошибки:**
- `404`

---

### POST /api/v1/companies/{companyId}/statements/{statementId}/confirm
Подтвердить импорт → включить в аналитику.

**Аутентификация:** Bearer, write-доступ

**Path параметры:**
- `companyId`, `statementId`

**Ответ (200 OK):**
```json
{
  "id": "st_02",
  "status": "CONFIRMED",
  "message": "Выписка подтверждена и включена в аналитику"
}
```

**Ошибки:**
- `404` / `409` — уже подтверждена / не в нужном статусе

---

### GET /api/v1/companies/{companyId}/transactions
Операции с фильтрами.

**Аутентификация:** Bearer, доступ к компании

**Path параметры:**
- `companyId`

**Query параметры:**
- `category` — enum категории
- `direction` — `IN` / `OUT`
- `q` — поиск
- `dateFrom`, `dateTo`
- `limit` (1…500, default 100), `offset`

**Ответ (200 OK):**
```json
[
  {
    "id": "tx_01",
    "companyId": "cmp_01",
    "statementId": "st_02",
    "date": "2026-09-15",
    "amount": "125000.00",
    "currency": "RUB",
    "direction": "IN",
    "category": "REVENUE",
    "counterparty": "ООО Покупатель",
    "purpose": "Оплата по счёту 42",
    "description": null,
    "balanceAfter": "410000.00"
  }
]
```

**Ошибки:**
- `404`

---

### PATCH /api/v1/companies/{companyId}/transactions/{transactionId}
Исправить категорию / описание.

**Аутентификация:** Bearer, write-доступ

**Path параметры:**
- `companyId`, `transactionId`

**Тело запроса:**
```json
{
  "category": "RENT",
  "purpose": "Аренда октября",
  "description": "Переклассифицировано вручную"
}
```

**Ответ (200 OK):** `TransactionOut`

**Ошибки:**
- `404` / `422`

---

### GET /api/v1/companies/{companyId}/transactions/analytics
Агрегаты по категориям, recurring, exclusions.

**Аутентификация:** Bearer, доступ к компании

**Path параметры:**
- `companyId`

**Query параметры:**
- `period` — default `6m`

**Ответ (200 OK):**
```json
{
  "byCategory": [
    { "category": "REVENUE", "amount": "5200000.00", "count": 40 }
  ],
  "recurring": [
    { "label": "Аренда", "amount": "180000.00", "cadence": "MONTHLY" }
  ],
  "exclusions": {},
  "period": "6m"
}
```

**Ошибки:**
- `404`

---

### GET /api/v1/companies/{companyId}/finance/summary
Сводка cashflow / остатки / обязательства.

**Аутентификация:** Bearer, доступ к компании

**Path параметры:**
- `companyId`

**Query параметры:**
- `period` — default `6m`

**Ответ (200 OK):**
```json
{
  "period": "6m",
  "currency": "RUB",
  "revenue": "5200000.00",
  "inflow": "5400000.00",
  "outflow": "4800000.00",
  "netCashFlow": "600000.00",
  "cashBalance": "410000.00",
  "liabilities": "250000.00",
  "activeCredits": "180000.00",
  "debtLoad": "0.28",
  "source": "aggregated",
  "asOf": "2026-10-22T00:00:00Z",
  "statementConfirmed": true
}
```

**Ошибки:**
- `404`

---

### GET /api/v1/companies/{companyId}/finance/series
Ряды для графиков.

**Аутентификация:** Bearer, доступ к компании

**Path параметры:**
- `companyId`

**Query параметры:**
- `period` — default `12m`

**Ответ (200 OK):**
```json
{
  "period": "12m",
  "currency": "RUB",
  "points": [
    {
      "period": "2026-09",
      "inflow": "920000.00",
      "outflow": "810000.00",
      "net": "110000.00",
      "cashBalance": "410000.00"
    }
  ],
  "source": "transactions"
}
```

**Ошибки:**
- `404`

---

### POST /api/v1/companies/{companyId}/finance/forecasts
Построить прогноз CF. **201**. Достаточно read-доступа (ANALYST тоже может).

**Аутентификация:** Bearer, доступ к компании

**Path параметры:**
- `companyId`

**Тело запроса:**
```json
{
  "horizonDays": 90,
  "includeUncertainty": true,
  "plannedPayments": [
    { "date": "2026-11-01", "amount": "180000.00", "label": "Аренда" }
  ]
}
```

**Ответ (201 Created):**
```json
{
  "id": "fc_01",
  "status": "COMPLETED",
  "currency": "RUB",
  "horizonDays": 90,
  "model": { "type": "HEURISTIC_CF" },
  "quality": { "coverageDays": 180 },
  "points": [
    {
      "date": "2026-11-15",
      "p50": "380000.00",
      "p10": "250000.00",
      "p90": "510000.00"
    }
  ],
  "cashGaps": [],
  "warning": null,
  "createdAt": "2026-10-22T14:00:00Z"
}
```

**Ошибки:**
- `404` / `422` — horizon вне 30…180

---

### GET /api/v1/companies/{companyId}/finance/forecasts/{forecastId}
Получить прогноз.

**Аутентификация:** Bearer, доступ к компании

**Path параметры:**
- `companyId`, `forecastId`

**Ответ (200 OK):** `ForecastOut`

**Ошибки:**
- `404`

---

### POST /api/v1/companies/{companyId}/finance/scenarios
What-if сценарий (кредит / выручка / расходы / stress). **201**. Read-доступ достаточен.

**Аутентификация:** Bearer, доступ к компании

**Path параметры:**
- `companyId`

**Тело запроса:**
```json
{
  "name": "Кредит 1.5 млн + stress",
  "loanAmount": "1500000.00",
  "revenueChangePct": -10,
  "expenseChangePct": 5,
  "stress": true,
  "parameters": { "termMonths": 12, "rate": "19.00" }
}
```

**Ответ (201 Created):**
```json
{
  "id": "sc_01",
  "companyId": "cmp_01",
  "name": "Кредит 1.5 млн + stress",
  "parameters": {
    "loanAmount": "1500000.00",
    "revenueChangePct": -10,
    "expenseChangePct": 5,
    "stress": true
  },
  "result": {
    "monthlyPayment": "138500.00",
    "cashGapMonths": 1,
    "currency": "RUB"
  },
  "createdAt": "2026-10-22T14:10:00Z"
}
```

**Ошибки:**
- `404` / `422`

---

### GET /api/v1/companies/{companyId}/finance/scenarios
Список сохранённых сценариев.

**Аутентификация:** Bearer, доступ к компании

**Path параметры:**
- `companyId`

**Ответ (200 OK):** массив `ScenarioOut`

**Ошибки:**
- `404`

---

### GET /api/v1/companies/{companyId}/finance/scenarios/{scenarioId}
Один сценарий.

**Аутентификация:** Bearer, доступ к компании

**Path параметры:**
- `companyId`, `scenarioId`

**Ответ (200 OK):** `ScenarioOut`

**Ошибки:**
- `404`

---

### GET /api/v1/companies/{companyId}/credit-passport
Агрегированный кредитный паспорт (не БКИ).

**Аутентификация:** Bearer, доступ к компании

**Path параметры:**
- `companyId`

**Ответ (200 OK):**
```json
{
  "companyId": "cmp_01",
  "refreshedAt": "2026-10-22T14:20:00Z",
  "sources": [
    { "type": "STATEMENT", "asOf": "2026-10-10T09:00:00Z" },
    { "type": "FINANCIAL_SNAPSHOT", "asOf": "2026-10-18T12:00:00Z" }
  ],
  "profile": {
    "inn": "7701234567",
    "name": "ООО «Кофе Плюс»",
    "legalForm": "OOO",
    "region": "Москва"
  },
  "financials": {
    "avgMonthlyRevenue": "980000.00",
    "cashBalance": "410000.00",
    "currency": "RUB"
  },
  "creditExposure": {
    "activeCredits": "180000.00",
    "liabilities": "250000.00"
  },
  "applicationsSummary": { "open": 1, "approved": 0, "rejected": 0 },
  "disclaimer": "Кредитный паспорт — агрегация демо-данных платформы, не бюро кредитных историй."
}
```

**Ошибки:**
- `404`

---

### POST /api/v1/companies/{companyId}/credit-passport/refresh
Пересобрать паспорт + audit.

**Аутентификация:** Bearer, доступ к компании

**Path параметры:**
- `companyId`

**Ответ (200 OK):** `CreditPassportOut`

**Ошибки:**
- `404`

---

### GET /api/v1/companies/{companyId}/credit-readiness
Индекс готовности данных к подаче (не вероятность одобрения).

**Аутентификация:** Bearer, доступ к компании

**Path параметры:**
- `companyId`

**Ответ (200 OK):**
```json
{
  "companyId": "cmp_01",
  "score": 78,
  "maxScore": 100,
  "checklist": [
    { "key": "STATEMENT_CONFIRMED", "ok": true },
    { "key": "FINANCIALS_PRESENT", "ok": true },
    { "key": "FUNDING_NEED", "ok": false }
  ],
  "factors": [
    { "key": "STATEMENT_AGE", "impact": -5, "detail": "Выписка старше 30 дней" }
  ],
  "missing": ["FUNDING_NEED"],
  "recommendations": ["Создайте потребность в финансировании"],
  "version": "readiness-v1",
  "disclaimer": "Индекс готовности данных — не вероятность одобрения и не скоринг банка."
}
```

**Ошибки:**
- `404`

---

### GET /api/v1/assistant/status
Статус AI-ассистента (LLM on/off / fallback).

**Аутентификация:** Bearer (любая роль)

**Ответ (200 OK):**
```json
{
  "ready": true,
  "mode": "RULES_FALLBACK",
  "modelActive": null,
  "disclaimer": "Локальная модель опциональна; активен rule-based fallback."
}
```

**Ошибки:**
- `401`

---

### GET /api/v1/companies/{companyId}/assistant/conversations
Диалоги текущего пользователя по компании.

**Аутентификация:** Bearer, доступ к компании

**Path параметры:**
- `companyId`

**Ответ (200 OK):**
```json
[
  {
    "id": "conv_01",
    "companyId": "cmp_01",
    "title": "Подбор продукта",
    "createdAt": "2026-10-21T09:00:00Z"
  }
]
```

**Ошибки:**
- `404`

---

### POST /api/v1/companies/{companyId}/assistant/conversations
Создать диалог. **201**.

**Аутентификация:** Bearer, write-доступ

**Path параметры:**
- `companyId`

**Тело запроса:**
```json
{
  "title": "Вопросы по заявке"
}
```

**Ответ (201 Created):**
```json
{
  "id": "conv_02",
  "companyId": "cmp_01",
  "title": "Вопросы по заявке",
  "createdAt": "2026-10-22T15:00:00Z"
}
```

**Ошибки:**
- `403` / `404`

---

### GET /api/v1/companies/{companyId}/assistant/conversations/{conversationId}/messages
История сообщений диалога.

**Аутентификация:** Bearer, доступ к компании (свой диалог)

**Path параметры:**
- `companyId`, `conversationId`

**Ответ (200 OK):**
```json
[
  {
    "id": "msg_01",
    "role": "user",
    "content": "Какой продукт лучше под закупку товара?",
    "sources": [],
    "suggestedActions": [],
    "createdAt": "2026-10-22T15:01:00Z"
  },
  {
    "id": "msg_02",
    "role": "assistant",
    "content": "По цели inventory_purchase чаще подходит оборотный кредит…",
    "sources": ["product:prd_wc_01"],
    "suggestedActions": [
      { "type": "OPEN_PRODUCT", "label": "Открыть оборотный", "id": "prd_wc_01" }
    ],
    "createdAt": "2026-10-22T15:01:01Z"
  }
]
```

**Ошибки:**
- `404`

---

### POST /api/v1/companies/{companyId}/assistant/conversations/{conversationId}/messages
Отправить сообщение → ответ агента.

**Аутентификация:** Bearer, write-доступ

**Path параметры:**
- `companyId`, `conversationId`

**Тело запроса:**
```json
{
  "content": "Смогу ли я потянуть платёж 110 тыс. в месяц?",
  "applicationId": "app_01"
}
```

**Ответ (200 OK):** `AssistantMessageOut` (роль `assistant`).

**Ошибки:**
- `404` / `422` / `503` — AI недоступен

---

## AI-агент

Роль и факты определяются **только сервером**. При `LLM_ENABLED=false` — шаблонный fallback (`mode: "template"`).  
Тела запросов — camelCase (`APIModel`). Ответ `AgentResponse` — поля контракта агента + `responseId`.

---

### POST /api/v1/applications/{applicationId}/ai/explanation
Разъяснение решения/статуса заявки.

**Аутентификация:** Bearer, доступ к заявке

**Path параметры:**
- `applicationId`

**Тело запроса:**
```json
{
  "question": "Почему снизили сумму?"
}
```

**Ответ (200 OK):**
```json
{
  "responseId": "aud_agent_01",
  "summary": "Сумма скорректирована из-за долговой нагрузки.",
  "mainReasons": [
    {
      "sourceId": "fact:debt_load",
      "text": "Отношение обязательств к выручке выше комфортного порога политики",
      "scope": "request",
      "factorId": "DEBT_LOAD",
      "ruleId": "maxDebtLoad",
      "productId": null
    }
  ],
  "whatToChange": [
    {
      "sourceId": "fact:cash",
      "text": "Увеличить подтверждённый остаток или снизить запрашиваемую сумму",
      "scope": "request",
      "factorId": "CASH_BALANCE",
      "ruleId": null,
      "productId": null
    }
  ],
  "nextSteps": ["Просмотреть контрпредложение", "Загрузить свежую выписку"],
  "productIds": ["prd_wc_01"],
  "prefill": {},
  "mode": "template",
  "promptVersion": "credit-explanations-v1",
  "model": null,
  "validationErrors": [],
  "scoreComplete": true,
  "disclaimer": "Предварительная оценка на синтетических данных; не гарантия выдачи кредита."
}
```

**Ошибки:**
- `403` / `404` / `503`

---

### POST /api/v1/applications/{applicationId}/ai/chat
Чат-форма того же ядра explanation.

**Аутентификация:** Bearer, доступ к заявке

**Path параметры:**
- `applicationId`

**Тело запроса:**
```json
{
  "question": "Что будет после принятия оффера?"
}
```

**Ответ (200 OK):** тот же `AgentOut`, что у `/ai/explanation`.

**Ошибки:**
- `403` / `404` / `503`

---

### POST /api/v1/companies/{companyId}/ai/product-selection
Подбор продукта под цель/сумму/срок. Обычно `ENTREPRENEUR`.

**Аутентификация:** Bearer, доступ к компании

**Path параметры:**
- `companyId`

**Тело запроса:**
```json
{
  "question": "Нужны деньги на закупку кофе и упаковки",
  "goal": "inventory_purchase",
  "amount": 1500000,
  "termMonths": 12
}
```

**Ответ (200 OK):** `AgentOut` с `productIds` и опциональным `prefill` под заявку.

**Ошибки:**
- `403` / `404` / `400` — нет financials
- `503`

---

### POST /api/v1/ai/responses/{responseId}/feedback
Фидбек автора ответа (audit). Только свой `responseId`.

**Аутентификация:** Bearer (автор ответа)

**Path параметры:**
- `responseId`

**Тело запроса:**
```json
{
  "helpful": true,
  "comment": "Понятно объяснили контрпредложение"
}
```

**Ответ (200 OK):**
```json
{
  "saved": true
}
```

**Ошибки:**
- `404` — ответ не найден / чужой

---

## Устаревшие ручки

Старые маршруты без `companyId` в path. Новый UI — только `/companies/{companyId}/applications/*`. Здесь — кратко, но каждый path отдельным заголовком.

---

### POST /api/v1/applications
**Deprecated.** Создать DRAFT. Idempotency — в **body** `idempotencyKey` (не header). **201** полный `ApplicationOut`.

**Аутентификация:** Bearer, `ENTREPRENEUR` write

**Тело запроса:**
```json
{
  "companyId": "cmp_01",
  "productId": "prd_wc_01",
  "amount": "1500000.00",
  "termMonths": 12,
  "rate": "18.50",
  "purpose": "Закупка товара",
  "fundingNeedId": "fn_01",
  "goalType": "inventory_purchase",
  "idempotencyKey": "idem_legacy_01",
  "currency": "RUB"
}
```

**Ответ (201 Created):** `ApplicationOut`

**Ошибки:**
- `403` / `409` / `422`

---

### GET /api/v1/applications
**Deprecated.** E — свои; A — очередь без DRAFT. Query `companyId`.

**Аутентификация:** Bearer, `ENTREPRENEUR` | `ANALYST`

**Query параметры:**
- `companyId` — опционально

**Ответ (200 OK):** массив `ApplicationOut`

**Ошибки:**
- `403` — ADMIN и прочие

---

### GET /api/v1/applications/{applicationId}
**Deprecated.** Карточка без company в path.

**Аутентификация:** Bearer, доступ к заявке

**Path параметры:**
- `applicationId`

**Ответ (200 OK):** `ApplicationOut`

**Ошибки:**
- `403` / `404`

---

### PATCH /api/v1/applications/{applicationId}
**Deprecated.** Патч DRAFT (optimistic lock через `version`).

**Аутентификация:** Bearer, write

**Path параметры:**
- `applicationId`

**Тело запроса:**
```json
{
  "requestedAmount": "1400000.00",
  "termMonths": 10,
  "version": 1
}
```

**Ответ (200 OK):** `ApplicationOut`

**Ошибки:**
- `409` — conflict version
- `404`

---

### POST /api/v1/applications/{applicationId}/submit
**Deprecated.** Отправка. Header `Idempotency-Key`. Ответ **200** `ApplicationOut` (company-route → **202** SubmitOut).

**Аутентификация:** Bearer, write

**Path параметры:**
- `applicationId`

**Headers:**
- `Idempotency-Key` — рекомендуется

**Ответ (200 OK):** `ApplicationOut` со статусом после submit/scoring.

**Ошибки:**
- `422` — валидация
- `409` / `404`

---

### POST /api/v1/applications/{applicationId}/documents
**Deprecated.** Upload. Form field `document_type` (не `docType`). **200** `ApplicationOut`.

**Аутентификация:** Bearer, write

**Path параметры:**
- `applicationId`

**Тело запроса:** `multipart/form-data`
- `file`
- `document_type` — default `OTHER`

**Ответ (200 OK):** `ApplicationOut`

**Ошибки:**
- `413` / `404` / `422`

---

### PATCH /api/v1/applications/{applicationId}/status
Смена статуса аналитиком (+ авто decision/offers). Не deprecated-флаг, но legacy-контур рядом с `/analyst/*/propose`.

**Аутентификация:** Bearer, роль `ANALYST`

**Path параметры:**
- `applicationId`

**Тело запроса:**
```json
{
  "status": "APPROVED",
  "comment": "Ок по выписке",
  "idempotencyKey": "st_chg_01"
}
```

**Ответ (200 OK):** `ApplicationOut`

**Ошибки:**
- `403` — не ANALYST
- `409` — invalid transition
- `404`

---

### POST /api/v1/applications/{applicationId}/request-documents
Legacy-запрос документов аналитиком (новый путь — `/analyst/.../document-requests`).

**Аутентификация:** Bearer, роль `ANALYST`

**Path параметры:**
- `applicationId`

**Тело запроса:**
```json
{
  "documentType": "BANK_STATEMENT",
  "comment": "Нужна выписка за 6 месяцев"
}
```

**Ответ (200 OK):** `ApplicationOut` (статус обычно `DOCS_REQUESTED`).

**Ошибки:**
- `403` / `404` / `422`

---

---

## Примеры использования

```bash
# 1. Логин
curl -s -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"login":"ip@demo.alfa","password":"demo1234"}'

# 2. Список компаний
curl -s "http://localhost:8000/api/v1/companies" \
  -H "Authorization: Bearer $TOKEN"

# 3. Создать черновик заявки
curl -s -X POST "http://localhost:8000/api/v1/companies/company_001/applications" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-draft-1" \
  -d '{
    "productId": "working_capital_01",
    "requestedAmount": "1500000.00",
    "termMonths": 12,
    "purpose": "Закупка товара"
  }'

# 4. Отправить заявку
curl -s -X POST "http://localhost:8000/api/v1/companies/company_001/applications/$APP_ID/submit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: demo-submit-1"

# 5. Очередь аналитика
curl -s "http://localhost:8000/api/v1/analyst/applications" \
  -H "Authorization: Bearer $ANALYST_TOKEN"
```

---
