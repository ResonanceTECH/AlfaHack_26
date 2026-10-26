# Линия решения - Frontend

React / TypeScript / Vite / MUI. Данные с FastAPI (`/api/v1`).  
Контракт эндпоинтов: **[docs/ENDPOINTS.md](./docs/ENDPOINTS.md)**.

## Что сделано

- Три кабинета в одном приложении: **предприниматель**, **аналитик**, **админ** - разные меню и home после логина.
- Auth + RBAC на роутах (`Protected`), выбор компании для бизнес-ролей.
- **Предприниматель:** онбординг (компания / финансы), дашборд, подбор продукта, заявки, документы, ответы на doc-request, офферы (принять/отклонить), публичный чат с банком.
- **Аналитик:** очередь и «мои» с `/api/v1/analyst/*`, карточка заявки (обзор -> решение), assign, запрос документов, проверки, propose (одобрить / отклонить / контр / нужна инфо), чат (публичный + внутренний). UI без API-жаргона.
- **Админ:** обзор, пользователи, продукты, политика, аудит, уведомления (часть экранов ещё на демо-данных).
- Общее: профиль, помощь (контент зависит от роли), уведомления из хедера, design-system на `/design-system`.

## Роли -> куда попадаете

| Роль                                   | Seed email                      | Home           | Доступ                           |
|----------------------------------------|---------------------------------|----------------|----------------------------------|
| `entrepreneur` / `accountant`          | `ip@demo.alfa`, `ooo@demo.alfa` | `/app`         | Кабинет бизнеса (нужна компания) |
| `analyst` / `manager` / `risk_analyst` | `analyst@demo.alfa`             | `/app/analyst` | Кабинет аналитика                |
| `admin`                                | `admin@demo.alfa`               | `/app/admin`   | Админка                          |

Пароль seed: `demo1234` (детали - [корневой README §9](../README.md#9-синтетические-тестовые-данные-и-учётные-записи)).

Чужой кабинет по URL редиректит на свой home.

## Клиентские пути

### Публичные

| Путь                                                             | Экран      |
|------------------------------------------------------------------|------------|
| `/`                                                              | Лендинг    |
| `/login`, `/verify-email`, `/forgot-password`, `/reset-password` | Auth       |
| `/design-system`                                                 | Витрина UI |

### Онбординг (entrepreneur / accountant)

| Путь                   | Экран             |
|------------------------|-------------------|
| `/select-company`      | Выбор компании    |
| `/onboarding/company`  | Создание компании |
| `/onboarding/finances` | Финансы           |
| `/onboarding/confirm`  | Подтверждение     |

### Предприниматель - `/app/*`

| Путь                                                                                               | Экран                   |
|----------------------------------------------------------------------------------------------------|-------------------------|
| `/app`                                                                                             | Главная                 |
| `/app/company`, `/app/company/inn-check`                                                           | Компания / проверка ИНН |
| `/app/statements`, `.../upload`, `.../analysis`                                                    | Финансовый профиль      |
| `/app/ai`                                                                                          | AI-консультант          |
| `/app/recommendations` -> `.../budget` -> `.../results`                                            | Подбор                  |
| `/app/scenarios`, `/app/forecast`, `/app/readiness`, `/app/roi`, `/app/compare`, `/app/calculator` | Сценарии и калькуляторы |
| `/app/applications`, `.../new`, `.../:id`, `.../edit`, `.../documents`, `.../contract`             | Заявки                  |
| `/app/documents`, `/app/documents/:docId`                                                          | Документы               |
| `/app/calendar`, `/app/team`, `/app/team/*`                                                        | Календарь, команда      |
| `/app/notifications`, `/app/help`, `/app/profile`                                                  | Сервис                  |

### Аналитик - `/app/analyst/*`

Роли: `analyst`, `manager`, `risk_analyst`.

| Путь                                                        | Экран                               |
|-------------------------------------------------------------|-------------------------------------|
| `/app/analyst`                                              | Очередь                             |
| `/app/analyst/mine`                                         | Мои заявки                          |
| `/app/analyst/workflow`                                     | SLA / процесс                       |
| `/app/analyst/attention`                                    | Требуют внимания (прямой URL)       |
| `/app/analyst/cases/:caseId`                                | Обзор                               |
| `.../company`, `.../finance`, `.../documents`, `.../checks` | Карточка                            |
| `.../risks`, `.../explainability`                           | Риск / explain (часть демо)         |
| `.../ai`                                                    | Чат с клиентом                      |
| `.../decision`                                              | Решение                             |
| `.../history`                                               | История                             |
| `/app/help`, `/app/profile`, `/app/notifications`           | Сервис (уведомления - только хедер) |

Legacy `/app/manager` -> редирект на `/app/analyst`.

### Админ - `/app/admin/*`

| Путь                       | Экран               |
|----------------------------|---------------------|
| `/app/admin`               | Обзор               |
| `/app/admin/analytics`     | Аналитика конвейера |
| `/app/admin/products`      | Каталог продуктов   |
| `/app/admin/policy`        | Кредитная политика  |
| `/app/admin/users`         | Пользователи / роли |
| `/app/admin/audit`         | Аудит               |
| `/app/admin/notifications` | Уведомления         |

## API на клиенте (живые контуры)

- **Auth / companies / registry** - логин, компании, lookup ИНН, dashboard.
- **Credit** - продукты, recommendations, readiness, scenarios.
- **Applications (company)** - CRUD/submit, documents, decision/offers accept|decline, document-requests respond, comments.
- **Analyst** - queue, card, assign, checks, document-requests, propose, comments.

Остальное (часть админки, риски/explain, часть уведомлений) - UI готово, данные могут быть демо.

## Версии

Node **22** (`.nvmrc` / `.node-version`), npm >=10. Lock: `package-lock.json`. В Docker/CI - только `npm ci`.  
См. [VERSIONS.md](../VERSIONS.md).

## Quick start

**Весь стек (из корня репо):**

```bash
docker compose up --build
```

UI: http://localhost:8080

**Локально:**

```bash
# из корня: Postgres + Redis
docker compose up -d db redis

# backend (см. ../backend/README.md): .env, venv, alembic, seed, uvicorn :8000

cd frontend
nvm use && npm ci && npm run dev
```

http://localhost:5173 - Vite proxy `/api` -> `:8000`.

## Стек

React + TypeScript + Vite | MUI | React Router 7 | TanStack Query | Axios | RHF + Zod | Recharts

## Структура

```
frontend/
|-- README.md
|-- docs/
|   |-- ENDPOINTS.md
|   `-- design-system.md
|-- public/
|-- src/
|   |-- api/            # axios-клиенты -> FastAPI
|   |-- assets/
|   |-- components/     # landing, analyst shell, common, onboarding, ...
|   |-- contexts/       # AuthContext
|   |-- data/           # labels
|   |-- features/       # selection, credit, applications, analyst, team, scenarios, documents
|   |-- hooks/
|   |-- layouts/        # AppLayout (меню по роли)
|   |-- pages/          # кабинеты + pages/analyst/*
|   |-- routes/         # AppRouter + Protected
|   |-- theme/
|   |-- types/
|   |-- utils/
|   |-- App.tsx
|   `-- main.tsx
|-- package.json / package-lock.json
|-- vite.config.ts
|-- Dockerfile          # multi-stage: Node build -> Nginx
`-- .env.example
```

Корень репо и backend: [../README.md](../README.md), [../backend/README.md](../backend/README.md).
