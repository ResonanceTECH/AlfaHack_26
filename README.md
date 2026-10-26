![Линия решения - умный путь бизнеса к финансированию](./docs/hero-banner.jpg)

# AlfaHack_26 - Линия решения

**Линия решения** - цифровой кабинет для малого и среднего бизнеса: от финансового профиля и банковской выписки до подбора кредитного продукта, сравнения условий и подачи демо-заявки. Рядом - AI-консультант, сценарии нагрузки и готовность документов.

> Это решение хакатона **«Альфа-Будущее»**.

https://drive.google.com/drive/folders/1s3jRZ7dEbMVaaJjWIir_uSogXcXnIuoj - ссылка на презентацию и видео

---

## Содержание

1. [Назначение](#1-назначение)
2. [Архитектура](#2-архитектура)
3. [Требования к окружению](#3-требования-к-окружению)
4. [Быстрый запуск](#4-быстрый-запуск)
5. [Локальная разработка](#5-локальная-разработка)
6. [Конфигурация и переменные окружения](#6-конфигурация-и-переменные-окружения)
7. [Компоненты решения](#7-компоненты-решения)
8. [Пошаговый сценарий проверки](#8-пошаговый-сценарий-проверки)
9. [Синтетические тестовые данные и учётные записи](#9-синтетические-тестовые-данные-и-учётные-записи)
10. [Версии и lock-файлы](#10-версии-и-lock-файлы)
11. [Структура репозитория](#11-структура-репозитория)

### Документация модулей

| Модуль                         | README                                                                                                            |
|--------------------------------|-------------------------------------------------------------------------------------------------------------------|
| Backend (API, БД, seed, тесты) | [backend/README.md](./backend/README.md), API: [backend/api.md](./backend/api.md)                                 |
| Frontend (UI, роли, маршруты)  | [frontend/README.md](./frontend/README.md), эндпоинты: [frontend/docs/ENDPOINTS.md](./frontend/docs/ENDPOINTS.md) |
| Scoring / credit agent         | [scoring/README.md](./scoring/README.md), интеграция: [scoring/INTEGRATION.md](./scoring/INTEGRATION.md)          |
| Версии стека                   | [VERSIONS.md](./VERSIONS.md)                                                                                      |
| LLM Compose (опционально)      | [compose.llm.yml](./compose.llm.yml), notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)                 |

---

## 1. Назначение

| Для кого                        | Что даёт                                                                                           |
|---------------------------------|----------------------------------------------------------------------------------------------------|
| **Предприниматель / бухгалтер** | Профиль компании, выписки, цель финансирования, подбор и сравнение продуктов, заявка, AI-подсказки |
| **Аналитик банка**              | Очередь заявок, статусы, запрос документов                                                         |
| **Жюри / проверка**             | Воспроизводимый Docker-стек, seed-данные, один сквозной сценарий использования                     |

**Ключевые пользовательские сценарии**

1. Авторизация -> выбор компании -> кабинет.
2. Финансовый профиль: загрузка выписки -> анализ денежного потока.
3. Подбор кредита: цель -> бюджет -> результаты -> (опционально) сравнение -> заявка.
4. AI-консультант по условиям и документам в контексте заявки/компании.
5. Заявки: черновик / отправка в очередь аналитика.

---

## 2. Архитектура

### 2.1. Высокоуровневая схема (C4 context / containers)

```mermaid
flowchart TB
  subgraph Users["Пользователи"]
    E["Предприниматель / бухгалтер"]
    M["Кредитный менеджер"]
  end

  subgraph Browser["Браузер"]
    SPA["React SPA<br/>Vite + MUI<br/>:5173 dev / :8080 Docker"]
  end

  subgraph Edge["Edge"]
    NGX["Nginx<br/>static + /api proxy"]
  end

  subgraph App["Application"]
    API["FastAPI<br/>/api/v1<br/>:8000"]
  end

  subgraph Data["Data & cache"]
    PG[("PostgreSQL 16<br/>:5433->5432")]
    RD[("Redis 7<br/>:6379")]
    FS[("Uploads volume<br/>выписки / docs")]
  end

  E --> SPA
  M --> SPA
  SPA -->|"dev: Vite proxy /api"| API
  SPA -->|"prod: :8080"| NGX
  NGX -->|"/api/*"| API
  API --> PG
  API --> RD
  API --> FS
```

### 2.2. Поток запроса (runtime)

```mermaid
sequenceDiagram
  participant U as Browser
  participant F as Frontend
  participant A as FastAPI
  participant DB as Postgres
  participant R as Redis

  U->>F: UI action
  F->>A: HTTPS/HTTP JSON camelCase<br/>Bearer access + refresh
  alt 401 access expired
    A-->>F: 401
    F->>A: POST /auth/refresh
    A->>DB: session / user
    A-->>F: new tokens
    F->>A: retry original
  end
  A->>R: rate-limit / OTP / cache (где нужно)
  A->>DB: SQLAlchemy ORM
  A-->>F: DTO camelCase
  F-->>U: render
```

### 2.3. Доменные модули API

```mermaid
flowchart LR
  subgraph Gateway["/api/v1"]
    AUTH["auth"]
    CO["companies"]
    CR["credit"]
    AP["applications"]
    ST["statements / forecasts / ai"]
    MG["manager / analyst"]
    NT["notifications"]
  end

  AUTH --> CO
  CO --> ST
  CO --> CR
  CR --> AP
  AP --> MG
  AP --> NT
```

| Модуль                | Ответственность                                                   |
|-----------------------|-------------------------------------------------------------------|
| `auth`                | Регистрация, логин, refresh, OTP/email-коды (console в демо)      |
| `companies`           | Профиль, финансы, funding-needs (цели), dashboard, INN/registry   |
| `credit`              | Каталог продуктов, рекомендации, калькулятор, сценарии, readiness |
| `applications`        | Заявки, документы, статусы workflow                               |
| `statements`          | Импорт выписок, транзакции, прогноз, AI-chat                      |
| `manager` / `analyst` | Очередь и разбор со стороны банка                                 |
| `notifications`       | In-app уведомления                                                |

### 2.4. Frontend: зоны UI

```mermaid
flowchart TB
  L["Landing / Login"] --> SC["Select company"]
  SC --> D["Dashboard /app"]
  D --> FP["Финансовый профиль<br/>выписка -> анализ"]
  D --> SEL["Подбор<br/>цель -> бюджет -> результаты"]
  SEL --> CMP["Сравнение"]
  SEL --> APP["Заявка"]
  CMP --> APP
  D --> AI["AI-консультант"]
  D --> CAL["Календарь обязательств"]
  D --> CO["Профиль компании / команда"]
```

Стек UI: **React 19**, **TypeScript**, **Vite 8**, **MUI 6**, **TanStack Query**, **Axios**, **React Router 7**, **Recharts**, **RHF + Zod**.

Стек API: **FastAPI**, **SQLAlchemy 2**, **Alembic**, **Pydantic 2**, **PostgreSQL**, **Redis**, **JWT (PyJWT)**, **Argon2**.

---

## 3. Требования к окружению

| Компонент      | Минимум                                | Рекомендуется                    |
|----------------|----------------------------------------|----------------------------------|
| OS             | macOS / Linux / Windows + WSL2         | -                                |
| Docker         | Docker Engine 24+ / Compose v2         | Desktop с >=4 GB RAM контейнерам |
| Node.js        | **22** (см. `.nvmrc`)                  | 22.14.x                          |
| npm            | **>=10**                               | 10.9.x                           |
| Python         | **3.12.8** (см. `.python-version`)     | 3.12.x                           |
| Порты свободно | `5173`, `8000`, `8080`, `5433`, `6379` | -                                |

Зафиксированные версии и lock-файлы: **[VERSIONS.md](./VERSIONS.md)**.

---

## 4. Быстрый запуск

Полный стек (Postgres + Redis + API + Nginx UI):

```bash
git clone <repo-url> AlfaHack_26
cd AlfaHack_26

docker compose up --build
```

| Сервис            | URL                                                              |
|-------------------|------------------------------------------------------------------|
| **UI**            | http://localhost:8080                                            |
| **API / Swagger** | http://localhost:8000/docs                                       |
| **Health**        | http://localhost:8000/health                                     |
| Postgres          | `localhost:5433` (user/pass/db: `alfa` / `alfa` / `alfa_credit`) |
| Redis             | `localhost:6379`                                                 |

Compose при старте API выполняет: `alembic upgrade head` -> `python -m scripts.seed` -> `uvicorn`.

Остановка:

```bash
docker compose down
# с данными БД:
docker compose down -v
```
Модель загружена и готова к работе когда мы видим лог
model loaded
listening on http://0.0.0.0:8080
---

## 5. Локальная разработка

### 5.1. Инфраструктура

```bash
# из корня репозитория
docker compose up -d db redis
```

### 5.2. Backend

```bash
cd backend
cp .env.example .env

python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows:
# .venv\Scripts\activate

pip install -r requirements.lock

alembic upgrade head
python -m scripts.seed
uvicorn app.main:app --reload --port 8000
```

Swagger: http://localhost:8000/docs

### 5.3. Frontend

```bash
cd frontend
cp .env.example .env   # VITE_API_BASE=/api/v1

nvm use                # Node 22
npm ci                 # строго по package-lock.json
npm run dev
```

UI: http://localhost:5173 - Vite проксирует `/api` -> `http://localhost:8000`.

Подробнее: [backend/README.md](./backend/README.md), [frontend/README.md](./frontend/README.md).  
Карта эндпоинтов фронта: [frontend/docs/ENDPOINTS.md](./frontend/docs/ENDPOINTS.md).

---

## 6. Конфигурация и переменные окружения

### 6.1. Backend (`backend/.env`)

Шаблон: [`backend/.env.example`](./backend/.env.example).

| Переменная              | Назначение                                      | Пример                                                      |
|-------------------------|-------------------------------------------------|-------------------------------------------------------------|
| `APP_ENV`               | Режим (`development` / `docker` / `production`) | `development`                                               |
| `DEBUG`                 | Расширенные ошибки                              | `true`                                                      |
| `DATABASE_URL`          | SQLAlchemy URL (psycopg3)                       | `postgresql+psycopg://alfa:alfa@localhost:5433/alfa_credit` |
| `REDIS_URL`             | Redis                                           | `redis://localhost:6379/0`                                  |
| `JWT_SECRET_KEY`        | Секрет подписи JWT                              | длинная случайная строка                                    |
| `JWT_ALGORITHM`         | Алгоритм (опц., default HS256)                  | `HS256`                                                     |
| `FRONTEND_URL`          | CORS / ссылки в письмах                         | `http://localhost:5173`                                     |
| `BACKEND_URL`           | Публичный URL API                               | `http://localhost:8000`                                     |
| `CORS_ORIGINS`          | Список origin через запятую                     | `http://localhost:5173,...`                                 |
| `ML_SERVICE_ENABLED`    | Внешний ML (выкл. в демо)                       | `false`                                                     |
| `ML_SERVICE_URL`        | URL ML-сервиса                                  | пусто                                                       |
| `UPLOAD_DIR`            | Каталог загрузок                                | `./uploads`                                                 |
| `MAX_UPLOAD_MB`         | Лимит файла                                     | `15`                                                        |
| `RATE_LIMIT_PER_MINUTE` | Rate limit                                      | `120`                                                       |

В Docker Compose переменные API задаются в `docker-compose.yml` (не нужен `.env` на хосте для контейнера `api`).

### 6.2. Frontend (`frontend/.env`)

| Переменная      | Назначение            | Пример    |
|-----------------|-----------------------|-----------|
| `VITE_API_BASE` | Префикс API для Axios | `/api/v1` |

В Docker-сборке фронта `VITE_API_BASE=/api/v1` задаётся в `frontend/Dockerfile`; Nginx проксирует `/api` на сервис `api`.

### 6.3. Compose-сервисы

| Сервис  | Образ / build                       | Порт       |
|---------|-------------------------------------|------------|
| `db`    | `postgres:16.6-alpine`              | 5433->5432 |
| `redis` | `redis:7.4-alpine`                  | 6379       |
| `api`   | `./backend` -> `python:3.12.8-slim` | 8000       |
| `web`   | `./frontend` -> nginx:1.27          | 8080->80   |

---

## 7. Компоненты решения

Детали по модулям - в их README (таблица в [содержании](#документация-модулей)). Карта экраны <-> API: [frontend/docs/ENDPOINTS.md](./frontend/docs/ENDPOINTS.md).

### 7.1. Backend (`backend/`)

Полное описание: [backend/README.md](./backend/README.md), справочник ручек: [backend/api.md](./backend/api.md).

| Путь                                     | Роль                                                   |
|------------------------------------------|--------------------------------------------------------|
| `app/main.py`                            | Точка входа FastAPI, CORS, middleware                  |
| `app/api/v1/*`                           | HTTP-роутеры                                           |
| `app/services/*`                         | Бизнес-логика (рекомендации, выписки, AI, заявки, ...) |
| `app/models/*`                           | SQLAlchemy-модели                                      |
| `app/schemas/*`                          | Pydantic DTO (camelCase на проводе)                    |
| `app/core/*`                             | JWT, RBAC, money, INN, ошибки                          |
| `alembic/`                               | Миграции                                               |
| `scripts/seed.py`                        | Демо-пользователи, компании, продукты                  |
| `api.md`                                 | Текстовый справочник API                               |
| `requirements.txt` + `requirements.lock` | Зависимости                                            |

### 7.2. Frontend (`frontend/`)

Полное описание: [frontend/README.md](./frontend/README.md).

| Путь                           | Роль                                                                 |
|--------------------------------|----------------------------------------------------------------------|
| `src/pages/*`                  | Экраны кабинета и лендинга (+ `pages/analyst/`)                      |
| `src/features/*`               | selection, credit, applications, analyst, team, scenarios, documents |
| `src/api/*`                    | Axios-клиенты к FastAPI                                              |
| `src/hooks/useAppStore.ts`     | Агрегация company / financials / goals / apps                        |
| `src/contexts/AuthContext.tsx` | Сессия, refresh, активная компания                                   |
| `src/layouts/AppLayout.tsx`    | Шелл кабинета                                                        |
| `docs/ENDPOINTS.md`            | Экраны <-> ручки API                                                 |

### 7.3. Scoring (`scoring/`)

Полное описание: [scoring/README.md](./scoring/README.md). Ядро - пакет `credit_scoring`; backend вызывает его при submit заявки и в credit-agent. LLM опционален (`compose.llm.yml`).

| Путь                                 | Роль                           |
|--------------------------------------|--------------------------------|
| `credit_scoring/`                    | Движок, модели, CLI, generator |
| `credit_scoring/config/scoring.yaml` | Веса и политика                |
| `tests/`                             | Pytest ядра                    |
| `INTEGRATION.md`                     | Контракты с backend            |

Локально: `python -m pip install -e ./scoring` из корня. Docker API: `docker build -f backend/Dockerfile .` (контекст - корень репо).

### 7.4. Клиентские «черновики» (localStorage)

Для UX хакатона часть состояния мастера живёт в браузере (параллельно API):

| Ключ                                     | Содержимое                                    |
|------------------------------------------|-----------------------------------------------|
| `alfa_selection_draft:{companyId}`       | Цель, сумма, срок, статьи бюджета, compareIds |
| `alfa_company_bank_accounts:{companyId}` | Банковские счета на вкладке компании          |
| `alfa_ai_threads:{companyId}`            | Треды AI-консультанта                         |

---

## 8. Пошаговый сценарий проверки

Ниже - минимальный после `docker compose up --build`.

### Шаг 0. Поднять стек

```bash
docker compose up --build
curl -s http://localhost:8000/health
```

Ожидание: JSON/OK от health, UI открывается на http://localhost:8080.

### Шаг 1. Логин предпринимателя

1. Открыть http://localhost:8080/login (или `:5173` в dev).
2. Email: `ip@demo.alfa` | пароль: `demo1234`.
3. Выбрать компанию (например ООО / ИП из seed).
4. Попасть в `/app` - дашборд.

### Шаг 2. Финансовый профиль и выписка

1. Меню -> **Финансовый профиль** (`/app/statements`).
2. **Загрузить выписку** -> drag&drop или «Выбрать файлы» (xlsx/csv/txt/pdf до 20 МБ).
3. **Запустить анализ** -> страница анализа (KPI, график остатка, контрагенты).

**Проверка:** есть блок «Поступления / Списания»; кнопка **К подбору кредита**.

### Шаг 3. Подбор кредита

1. **Подбор** (`/app/recommendations`) или переход с анализа.
2. Выбрать цель (например «Пополнение оборотных средств»), задать сумму/срок.
3. **Продолжить к бюджету** -> распределить статьи, слайдеры суммы/срока.
4. **К подбору** -> результаты с карточками продуктов и фильтрами.

**Проверка:** степпер на шаге 3 «Подбор продуктов»; у карточки есть **Сравнить** / **Выбрать**.

### Шаг 4a. Сравнение (опционально)

1. Отметить **Сравнить** у >=2 продуктов.
2. Кнопка **Сравнить (N)** -> `/app/compare`.
3. Таблица параметров, toggle «только различия», **Выбрать {продукт}**.

### Шаг 4b. Сразу заявка

1. На результатах нажать **Выбрать** у одного продукта (без сравнения).
2. Открывается `/app/applications/new`: карточка продукта, готовность, чекбокс.
3. Отметить подтверждение -> **Отправить заявку ->**.

**Проверка:** редирект в карточку/список заявок; заявка видна в **Мои заявки**.

### Шаг 5. AI-консультант

1. `/app/ai` -> задать вопрос (например «Почему предложили меньше суммы?»).
2. **+ Новый диалог** - пустой тред.

**Проверка:** ответ ассистента или демо-fallback; контекст компании в сайдбаре.

### Шаг 6. Компания и счета

1. `/app/company` -> вкладка **Банковские счета**.
2. **+ Добавить счёт** -> модалка -> сохранить.
3. **Посмотреть реквизиты** -> copy.

**Проверка:** счёт в списке; полнота профиля растёт после счёта/выписки.

### Шаг 7. Аналитик (роль банка)

1. Logout -> логин `analyst@demo.alfa` / `demo1234`.
2. Очередь / разбор заявок (в т.ч. seed `demo_missing_docs`).

**Проверка:** доступна банковская сторона; видны заявки из seed / отправленные на шаге 4.

### Шаг 8. API smoke (без UI)

```bash
# логин
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"login":"ip@demo.alfa","password":"demo1234"}'
```

---

## 9. Синтетические тестовые данные и учётные записи

Все данные ниже - **синтетика** для хакатона (не реальные клиенты банка).  
Источник наполнения БД: `backend/scripts/seed.py` (`SEED_VERSION=2026-10`).  
Поднимается автоматически в Docker (`alembic upgrade` -> `python -m scripts.seed`) или вручную:

```bash
cd backend && source .venv/bin/activate
alembic upgrade head
python -m scripts.seed
```

Повторный seed идемпотентен по задумке скрипта (пересоздание демо-набора).

### 9.1. Тестовые учётные записи

Единый пароль для всех seed-пользователей: `demo1234`.

| Login / Email       | Роль           | Назначение в E2E                                                    |
|---------------------|----------------|---------------------------------------------------------------------|
| `ip@demo.alfa`      | `ENTREPRENEUR` | Основной happy-path: кабинет ИП, выписки, подбор, заявка, AI        |
| `ooo@demo.alfa`     | `ENTREPRENEUR` | Второй тенант (изоляция данных), «рваный» cashflow, rejected-заявка |
| `analyst@demo.alfa` | `ANALYST`      | Очередь / разбор заявок со стороны банка                            |
| `admin@demo.alfa`   | `ADMIN`        | Админ-доступ / полный RBAC                                          |

> В UI поле логина принимает email. Аккаунты `manager@` / `buh@` в seed **не создаются** - для банковской стороны используйте `analyst@demo.alfa`.

**Рекомендуемый актёр сквозного сценария:** `ip@demo.alfa` / `demo1234`.

### 9.2. Компании и реестр (синтетический ЕГРЮЛ/ЕГРИП)

| ID            | Название                 | Форма | ИНН (валидная КС) | Регион          | Владелец        |
|---------------|--------------------------|-------|-------------------|-----------------|-----------------|
| `company_001` | ИП Петров Иван Сергеевич | IP    | `770123456703`    | Москва          | `ip@demo.alfa`  |
| `company_002` | ООО Секретные Данные     | OOO   | `7709876545`      | Санкт-Петербург | `ooo@demo.alfa` |

Дополнительно в синтетическом справочнике реестра (`app/services/registry.py`, source `SYNTHETIC_REGISTRY`):

| Название        | ИНН          | Назначение                              |
|-----------------|--------------|-----------------------------------------|
| ООО «Кофе Плюс» | `7701234560` | Проверка ИНН / UI без membership в seed |

На экране «Проверить ИНН» используйте любой из трёх ИНН выше.

### 9.3. Финансы и обязательства (`company_001`)

| Сущность           | Синтетика                                                                                                     |
|--------------------|---------------------------------------------------------------------------------------------------------------|
| Financial snapshot | Период `2026-09`: выручка ~900 000 ₽/мес, opex ~650 000, остаток ~420 000, долг/кредиты заданы                |
| Обязательства      | Аренда, ФОТ, УСН, поставщик «ДомТорг», платёж по кредиту (календарь)                                          |
| Funding need       | `need_001`: закупка сезонной партии, ~2 500 000 ₽, 12 мес (`demo_combined_funding`)                           |
| Выписка            | Импортированный demo CSV + набор транзакций сен-окт 2026 (контрагенты: ООО Ромашка, ИП Сидоров, ООО Уют, ...) |

`company_002` - урезанный/волатильный профиль для сценария `demo_unstable_cashflow`.

### 9.4. Каталог кредитных продуктов

| ID                   | Название                       | Тип             | Лимит (синтетика) | Срок      |
|----------------------|--------------------------------|-----------------|-------------------|-----------|
| `working_capital_01` | Оборотный кредит «Сезон»       | working_capital | 0,5-15 млн ₽      | 3-36 мес  |
| `credit_line_01`     | Возобновляемая кредитная линия | credit_line     | 1-20 млн ₽        | 6-36 мес  |
| `investment_01`      | Инвестиционный кредит «Рост»   | investment      | 1-50 млн ₽        | 12-84 мес |
| `overdraft_01`       | Овердрафт к расчётному счёту   | overdraft       | 0,1-5 млн ₽       | 1-12 мес  |

Ставки, комиссии и списки документов - демо; правила eligibility в `CreditProductRule` версии `demo-rules-v1`.

На UI подбора дополнительно могут показываться **фронтовые демо-карточки** (`frontend/src/features/selection/demoProducts.ts`: «Бизнес-Оборот», «Овердрафт Бизнес», «Бизнес-Рост») - они стыкуются с мастером, если API-рекомендации недоступны.

### 9.5. Заявки и сценарии seed

| Код сценария             | Суть                                      | Где смотреть       |
|--------------------------|-------------------------------------------|--------------------|
| `demo_approved`          | Заявка APPROVED + активный offer          | `ip@` / заявки ИП  |
| `demo_counteroffer`      | COUNTEROFFERED, меньшая сумма             | `ip@`              |
| `demo_missing_docs`      | DOCS_REQUESTED, открытый document request | `ip@` + `analyst@` |
| `demo_rejected`          | Отклонение на чужом тенанте               | `ooo@`             |
| `demo_unstable_cashflow` | Рваные поступления, высокий debt load     | `ooo@` / финансы   |
| `demo_combined_funding`  | Комбинация продуктов под цель             | funding need ИП    |

ID заявок в seed (ориентиры): `app_approved_01`, `app_counter_01`, и др. - см. `seed_payload` в `SCENARIOS`.

### 9.6. Файлы для ручной загрузки выписки

Для шага «Загрузить выписку» подойдёт любой из форматов UI: `.xlsx`, `.csv`, `.txt` (1С), `.pdf` <= 20 МБ.

Минимальный синтетический CSV (можно сохранить как `demo_vypiska.csv` и загрузить в UI):

```csv
date,amount,direction,counterparty,purpose
2026-09-03,85000,in,ООО Ромашка,Оплата по счёту за товары
2026-09-05,42000,out,Альфа-Банк,Платёж по кредиту
2026-09-12,450000,in,ИП Сидоров,Поступление за реализацию
2026-09-15,120000,out,Арендодатель,Аренда склада
2026-09-22,210000,in,ООО Уют,Оплата счёта-фактуры
2026-10-02,190000,in,ООО Ромашка,Оплата по счёту за товары
2026-10-08,175000,in,ИП Козлов,Поступление за реализацию
```

Либо опереться на уже посеянные транзакции ИП после seed (финпрофиль сразу с данными).

### 9.7. Сквозной E2E на синтетике

| # | Действие                                  | Учётка / данные                       |
|---|-------------------------------------------|---------------------------------------|
| 1 | Login -> выбор **ИП Петров**              | `ip@demo.alfa` / `demo1234`           |
| 2 | Дашборд, календарь обязательств           | seed obligations                      |
| 3 | Финансовый профиль / анализ               | seed txs или CSV из §9.6              |
| 4 | Подбор: цель «оборотные», сумма 2,5-5 млн | продукты §9.4 + UI-демо               |
| 5 | Выбрать продукт -> отправить заявку       | чекбокс демо-заявки                   |
| 6 | Мои заявки (+ seed approved/counter/docs) | `ip@`                                 |
| 7 | Logout -> `analyst@demo.alfa`             | очередь / docs request                |
| 8 | Logout -> `ooo@demo.alfa`                 | изоляция тенанта, unstable / rejected |

**API-проверка логина:**

```bash
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"login":"ip@demo.alfa","password":"demo1234"}'
```

Ожидание: JSON с access/refresh. Дальше Bearer к `/api/v1/companies`, `/api/v1/credit/products`.

---

## 10. Версии и lock-файлы

| Слой          | Механизм                                                       |
|---------------|----------------------------------------------------------------|
| Node 22       | `.nvmrc`, `frontend/.node-version`, `engines` в `package.json` |
| npm deps      | `frontend/package-lock.json` -> `npm ci`                       |
| Python 3.12.8 | `.python-version`                                              |
| pip deps      | `backend/requirements.txt` + `backend/requirements.lock`       |
| Docker        | pinned tags в Compose / Dockerfile                             |

Детали: **[VERSIONS.md](./VERSIONS.md)**.

---

## 11. Структура репозитория

```
AlfaHack_26/
|-- README.md                 # этот файл
|-- VERSIONS.md               # пины языков и зависимостей
|-- THIRD_PARTY_NOTICES.md
|-- docker-compose.yml        # db, redis, api, web
|-- compose.llm.yml           # опциональный локальный LLM
|-- pytest.ini
|-- docs/
|   |-- hero-banner.jpg
|   |-- documents/            # демо-PDF для сценариев
|   `-- qa/
|-- backend/                  # см. backend/README.md
|   |-- app/
|   |-- alembic/
|   |-- scripts/seed.py
|   |-- tests/
|   |-- api.md
|   |-- requirements.lock
|   |-- Dockerfile
|   `-- .env.example
|-- frontend/                 # см. frontend/README.md
|   |-- src/
|   |-- docs/ENDPOINTS.md
|   |-- package-lock.json
|   |-- Dockerfile            # Node build -> Nginx
|   `-- .env.example
|-- scoring/                  # см. scoring/README.md
|   |-- credit_scoring/
|   |-- tests/
|   |-- data/
|   |-- INTEGRATION.md
|   `-- pyproject.toml
`-- test/                     # доп. QA-наборы (см. test/README.md)
```
