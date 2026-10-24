# Alfa Credit — Frontend

React / TypeScript / Vite / MUI клиент. Данные только с FastAPI (`/api/v1`).

Эндпоинты, которые использует фронт: **[docs/ENDPOINTS.md](./docs/ENDPOINTS.md)** (пока логин и забыли пароль).

## Quick start

**Весь стек через Docker** (из корня репо):

```bash
docker compose up --build
```

UI: http://localhost:8080

**Локальная разработка:**

```bash
# 1. Backend (PostgreSQL :5433 + API :8000)
cd backend
cp .env.example .env
docker compose up -d
# миграции + seed
python -m scripts.seed   # или см. backend/README.md

# 2. Frontend
cd ../frontend
npm install
npm run dev
```

Откройте http://localhost:5173 — прокси Vite: `/api` → `localhost:8000`.

Seed-аккаунты бэкенда (если прогнали `scripts/seed.py`):

| Роль | Email | Пароль |
|------|-------|--------|
| Предприниматель | `ip@demo.alfa` | `demo1234` |
| Менеджер | `manager@demo.alfa` | `demo1234` |
| Бухгалтер | `buh@demo.alfa` | `demo1234` |

## Стек

- React + TypeScript + Vite
- MUI, React Router 7
- TanStack Query, Axios
- React Hook Form + Zod
- Recharts

## Структура

```
src/
  api/          # axios-клиенты к FastAPI
  components/   # общие UI
  contexts/     # auth
  data/         # labels
  features/     # кредитные виджеты
  hooks/        # useAppStore (React Query), UI prefs
  layouts/
  pages/
  routes/
  theme/
  types/
  utils/        # локальные финанс-расчёты (график, NPV) для UX
```
