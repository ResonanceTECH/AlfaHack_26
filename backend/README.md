# Backend — Alfa Business Credit API

FastAPI: auth/RBAC, компании, финансы, подбор кредитов, калькулятор, заявки, менеджер, выписки, прогноз, readiness, ROI, AI-консультант.

## Docker (из корня репо)

```bash
docker compose up --build
```

| | |
|--|--|
| Swagger | http://localhost:8000/docs |
| Health | http://localhost:8000/health |
| Postgres | `localhost:5433` |
| Redis | `localhost:6379` |

Compose поднимает БД, Redis, миграции, seed и API.

## Версии

Python **3.12.8** (`.python-version`). Зависимости: `requirements.txt` (прямые `==`) + полный lock `requirements.lock`.

```bash
pip install -r requirements.lock   # предпочтительно (CI / Docker)
# или: pip install -r requirements.txt && pip freeze > requirements.lock
```

Подробнее: [VERSIONS.md](../VERSIONS.md).

## Локальная разработка

```bash
# из корня
docker compose up -d db redis

cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -r requirements.lock
pip install -e ../scoring  # ядро экспертного скоринга
cp .env.example .env

alembic upgrade head
python -m scripts.seed
uvicorn app.main:app --reload --port 8000
```

## Демо-аккаунты (seed)

Пароль у всех: `demo1234`. Полный каталог синтетики — в корневом [README §9](../README.md#9-синтетические-тестовые-данные-и-учётные-записи).

| Роль | Email |
|------|-------|
| Предприниматель (ИП) | `ip@demo.alfa` |
| Предприниматель (ООО, другой тенант) | `ooo@demo.alfa` |
| Аналитик | `analyst@demo.alfa` |
| Админ | `admin@demo.alfa` |

## API (`/api/v1`)

Полный список — в Swagger. Основные группы:

| Группа | Назначение |
|--------|------------|
| `/auth/*` | регистрация/логин (email, phone OTP), refresh, logout |
| `/companies/*` | профиль, финансы, обязательства, бизнес-цели |
| `/credit/*` | продукты, рекомендации, калькулятор, сценарии, readiness |
| `/applications/*` | заявки, документы, статусы |
| `/manager/*` | очередь менеджера |
| `/statements/*`, `/forecasts/*`, `/ai/chat` | выписки, прогноз CF, консультант |

JSON на проводе — camelCase. Деньги — `NUMERIC`.

## Переменные окружения

См. `.env.example`. Минимум: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET_KEY`.  
SMS/email по умолчанию `console` (коды в лог). ML выключен (`ML_SERVICE_ENABLED=false`).

## Структура

```
backend/
  app/
    api/v1/
    core/
    db/
    models/
    schemas/
    services/
  alembic/
  scripts/seed.py
```

Рекомендации, прогноз и readiness — демо-инструменты, не официальное решение банка.

## Агент разъяснений

Новый модуль `app/services/credit_agent` подключён к чату; поддерживает
объяснение заявки и сводку аналитика, вопросы по заявке и подбор продукта.
По умолчанию `LLM_ENABLED=false`, включён шаблонный резерв.
CLI, переменные окружения, новые HTTP-ручки и запуск локальной модели:
[единый README модуля](../scoring/README.md).
