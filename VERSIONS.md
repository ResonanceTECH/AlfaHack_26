# Зафиксированные версии

Воспроизводимая сборка: языки и зависимости пинятся lock-файлами и файлами окружения.

## Языки рантайма

| Стек | Версия | Файл |
|------|--------|------|
| Node.js | **22** (LTS; Docker `22.14.0`) | `.nvmrc`, `frontend/.nvmrc`, `frontend/.node-version`, `frontend/package.json` → `engines` |
| npm | **≥10** (`packageManager`: `npm@10.9.2`) | `frontend/package.json` |
| Python | **3.12.8** | `.python-version`, `backend/.python-version`, `backend/Dockerfile` |

## Frontend (JS)

| Механизм | Путь |
|----------|------|
| Lock | `frontend/package-lock.json` (lockfileVersion 3) |
| Manifest | `frontend/package.json` |
| Установка | `npm ci` (только по lock; не `npm install` в CI/Docker) |

```bash
cd frontend
nvm use   # или fnm/asdf по .nvmrc
npm ci
```

## Backend (Python)

| Механизм | Путь |
|----------|------|
| Прямые зависимости | `backend/requirements.txt` (все `==`) |
| Полное дерево (транзитивные) | `backend/requirements.lock` |
| Установка | `pip install -r requirements.lock` |

```bash
cd backend
# pyenv / asdf читают .python-version
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.lock
```

Обновить lock после правок `requirements.txt`:

```bash
pip install -r requirements.txt
pip freeze > requirements.lock
```

## Инфраструктура (Docker Compose)

| Сервис | Образ |
|--------|-------|
| API | `python:3.12.8-slim` (Dockerfile) |
| Frontend build | `node:22.14.0-alpine` |
| Frontend serve | `nginx:1.27-alpine` |
| Postgres | `postgres:16.6-alpine` |
| Redis | `redis:7.4-alpine` |
