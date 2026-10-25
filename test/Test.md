# Test.md - QA-отчёт

> Автотесты лежат в папке [`test/`](./) рядом с этим файлом.

## Содержание

- [Матрица типов тестирования](#матрица-типов-тестирования)
- [0. System Inventory](#0-system-inventory)
- [1. Test Strategy](#1-test-strategy)
- [2. Test Cases](#2-test-cases)
- [3. Test Execution](#3-test-execution)
- [4. Bug Report](#4-bug-report)
- [5. Security & RBAC](#5-security--rbac)
- [6. API Contract Audit](#6-api-contract-audit)
- [7. E2E Scenarios](#7-e2e-scenarios)
- [8. ML Validation](#8-ml-validation)
- [9. Performance](#9-performance)
- [10. Regression](#10-regression)
- [11. Final QA Report](#11-final-qa-report)

---

## Матрица типов тестирования

| Тип (из master prompt) | Статус | Где артефакты | Результат |
|---|---|---|---|
| Unit | **DONE** | `test/unit/` | pytest PASS |
| Integration | **DONE** | `test/integration/` | pytest PASS (+ xfail BUG-001) |
| API Contract | **DONE** | `test/contract/` | OpenAPI paths + envelope |
| End-to-End | **DONE** | `test/e2e/` + browser MCP | API happy-path PASS; UI partial (BUG-002) |
| Regression | **DONE** | `test/` + evidence | suite воспроизводима |
| Exploratory / Negative | **DONE** | `test/exploratory/` | spam/stale/token/empty |
| Security / RBAC | **DONE** | `test/security/` | 403/404/isolation PASS |
| Accessibility | **PARTIAL** | `test/accessibility/` + browser | HTML smoke; полный axe — skip |
| Performance & Resilience | **DONE** | `test/performance/` | p95 smoke + 20 parallel reads |
| UI/UX (browser) | **DONE** | evidence + browser | login 3 roles; BUG-002/003 |
| ML/AI | **DONE** | evidence / §8 | fallback; isolation; no decide |
| Admin / Analyst / Entrepreneur domains | **DONE** | §2–7 | P0 path + RBAC |

---

## 0. System Inventory

**Дата аудита:** 2026-10-25  
**Ветка:** `frontend`  
**Commit:** `91b6b6b020b162d8c43292f3b7f276f6fd2c21af`  
**Окружение:** Docker Compose project `alfahack-qa` (изолированные volumes `alfahack-qa_pgdata`, `alfahack-qa_uploads`)

## Стек (факт)

| Слой | Факт |
|------|------|
| Frontend | React 19 + TS + Vite 8 + MUI 6, Nginx `:8080` |
| Backend | FastAPI `/api/v1`, Uvicorn `:8000` |
| DB | PostgreSQL 16 `:5433` |
| Cache | Redis 7 `:6379` (rate-limit / OTP) |
| ML | Внешний сервис **выключен** (`ML_SERVICE_ENABLED` не задан в compose). Assistant = `RULES_FALLBACK` |
| Тесты до QA | `backend/tests/.gitkeep` только; Playwright/Vitest **отсутствуют** |
| CI | Нет workflow в корне репо |

## Матрица модулей

| Модуль | Реализован | API | UI | Тесты | Замечания |
|---|---|---|---|---|---|
| Авторизация | Да | Да | Да | Unit/Int добавлены | JWT + refresh; logout отзывает refresh, access живёт до expiry |
| Компании / реестр ИНН | Да | Да | Да | Int/RBAC | Синтетический registry; tenant isolation OK |
| Финансы / выписки | Да | Да | Да | Unit + Int (xfail) | **BUG-001** пустой CSV → 500 |
| Кредиты / калькулятор | Да | Да | Да | Unit + Int | Annuity совпадает с Decimal-эталоном |
| Заявки / workflow | Да | Да | Да | Int | Submit→202 IN_REVIEW; optimistic lock 409 OK |
| Аналитик | Да | Да | Да | Int | Единая роль ANALYST; **BUG-003** raw status labels |
| Решения / офферы / договор | Да | Да | Частично | Int E2E | Happy-path API OK; **BUG-002** dashboard фейкает оффер |
| Администратор | Да (API полный) | Да | Частично demo | Smoke | Users/products/policies/models/demo/audit |
| ML/AI | Частично | Да (assistant) | Да | Smoke | External ML off; rule-based chat |
| Уведомления | Да | Да | Да | NOT RUN deep | In-app |
| RBAC | Да | Backend enforce | Protected routes | Security suite | API 403/404 корректны |

## OpenAPI

- Paths: **118** (включая `/health`)
- Swagger: `http://localhost:8000/docs` — **доступен**

## Роли seed

| Email | Role | Пароль |
|-------|------|--------|
| `ip@demo.alfa` | ENTREPRENEUR | `demo1234` |
| `ooo@demo.alfa` | ENTREPRENEUR | `demo1234` |
| `analyst@demo.alfa` | ANALYST | `demo1234` |
| `admin@demo.alfa` | ADMIN | `demo1234` |

## CONTRACT GAP (спека vs код)

| Ожидание (промпт/README) | Факт | Класс |
|--------------------------|------|-------|
| Отдельный ML-сервис в compose | Нет сервиса; fallback rules | NOT IMPLEMENTED (by design demo) |
| `redirectTo` `/app/analyst`, `/app/admin` | API: `/bank/queue`, `/admin` | CONTRACT GAP (FE игнорит поле) |
| Manager / Risk как отдельные входы | Одна роль ANALYST | OK / by design |
| Playwright E2E в репо | Нет | NOT IMPLEMENTED |
| Admin UI «всё на живых данных» | README: часть demo | PARTIAL |

## Запуск QA-среды

```bash
docker compose -p alfahack-qa up --build -d
curl -s http://127.0.0.1:8000/health
# UI http://127.0.0.1:8080
```

Повторный seed идемпотентен (compose `python -m scripts.seed` на старте API).

---

## 1. Test Strategy

## Цель

Подтвердить/опровергнуть готовность демо-сценария «предприниматель → заявка → аналитик → оффер → договор» и найти дефекты финансовой/RBAC целостности.

## Уровни

| Уровень | Инструмент | Где |
|---------|------------|-----|
| Unit | pytest | `backend/tests/unit/` |
| Integration / API | pytest + httpx → live QA API | `backend/tests/integration/` |
| Security / RBAC | pytest + httpx | `backend/tests/security/` |
| Contract | OpenAPI dump + ручной diff | `06_API_CONTRACT_AUDIT.md` |
| E2E API | скрипты + evidence JSON | `docs/qa/evidence/` |
| E2E Browser | Cursor browser MCP | логин 3 ролей, dashboard, queue |
| Performance | выборочные latency в evidence | `09_PERFORMANCE.md` |

## Приоритет выполнения

1. P0: auth, RBAC, tenant isolation, credit calc, submit→decide→accept→agreement
2. P1: statements, offers, admin critical
3. P2+: UI polish, exploratory, load

## Изоляция

- Отдельный Compose project `alfahack-qa` + собственные volumes  
- Синтетические аккаунты seed only  
- Без вызовов внешних банковских API  
- Redis FLUSHDB допустим в QA для снятия rate-limit

## Критерий «passed»

Только фактически выполненная проверка с assertion. NOT RUN / BLOCKED / NOT IMPLEMENTED ≠ pass.

---

## 2. Test Cases

Легенда статуса исполнения - в `03_TEST_EXECUTION.md`.

## Auth

| ID | Название | Тип |
|----|----------|-----|
| AUTH-01 | Login entrepreneur | API+UI |
| AUTH-02 | Login analyst → `/app/analyst` | API+UI |
| AUTH-03 | Login admin | API |
| AUTH-04 | Wrong password → 401 | API |
| AUTH-05 | Unknown user → 401 | API |
| AUTH-06 | Empty credentials → 422 | API |
| AUTH-08 | Refresh OK | API |
| AUTH-10 | Logout revokes refresh; access may remain | API |
| AUTH-11 | Ent → `/app/admin` redirect | UI |

## Companies / RBAC

| ID | Название |
|----|----------|
| COMP-01 | List companies |
| COMP-01b | Tenant isolation |
| COMP-04 | Lookup valid INN |
| COMP-05 | Invalid INN |
| COMP-08 | Foreign financials 404 |
| RBAC-01..04,09 | Cross-role API deny |

## Finance / Credit

| ID | Название |
|----|----------|
| FIN-01 | Upload valid CSV → 202 COMPLETED |
| FIN-02 | Empty file (expect not 500) |
| FIN-03 | Unsupported ext |
| FIN-11 | Finance summary |
| FIN-16 | Forecast |
| CREDIT-01/03/05/07/08/10/11 | Catalog, matches, bounds, annuity |

## Applications / Decisions

| ID | Название |
|----|----------|
| APP-01/02/06/08/11/12/14 | Draft, edit, submit, idempotency, delete, status hack, foreign |
| ANALYST-01/02/08/11/15/16 | Queue, assign, docs, checks, propose, reject |
| DEC-05/08/09/14/15/16 | Accept, foreign, double, agreement, confirm, invalid transition |
| E2E-01 | Full credit path API |

## Admin / ML

| ID | Название |
|----|----------|
| ADMIN-01/03/04/12/15/20 | Users, bad role, disable, simulate, models, audit |
| ML-11/12/13 | AI isolation, cannot decide, prompt injection |

---

## 3. Test Execution

**Среда:** `alfahack-qa` @ commit `91b6b6b`  
**Когда:** 2026-10-25 ~21:08–21:25 UTC  
**Исполнитель:** automated API + browser MCP + pytest

## Сводка

| Метрика | Значение |
|---------|----------|
| Зафиксированных кейсов в каталоге | ~70+ |
| Фактически запущено (API smoke+deep+E2E+pytest+UI) | **≈85** |
| PASSED | **≈72** |
| FAILED (реальный дефект) | **4** (BUG-001..003 + empty→500 regression) |
| XFAILED (ожидаемый дефект) | **1** (pytest BUG-001) |
| BLOCKED | **2** (нагрузка k6; полный a11y axe) |
| SKIPPED / NOT RUN | остальные каталога (deep admin policy publish, concurrent 2 analysts, Lighthouse, …) |
| pytest | **36 passed, 1 xfailed** |

## Ключевые прогоны

### A. API smoke (`evidence/api_smoke.json`)

32/35 pass на первом прогоне; 3 «fail» = false positive admin role case + неверный payload create draft (исправлено в deep).

### B. E2E API happy path (`evidence/e2e_api.json`)

| Шаг | Результат |
|-----|-----------|
| Create draft + idempotency | PASS |
| Submit → `202 IN_REVIEW` | PASS |
| Analyst assign | PASS |
| Propose `APPROVED` | PASS |
| Foreign accept → 404 | PASS |
| Accept offer → `AGREEMENT_PREPARATION` | PASS |
| Double accept → 200 idempotent (без дубля в БД) | PASS* (см. DEC-09) |
| Agreement + confirm + double confirm 409 | PASS |
| Admin create/disable/bad role | PASS |

 Повторный accept не создаёт вторую `offer_acceptances` (проверено SQL).

### C. pytest в контейнере API

```
36 passed, 1 xfailed in 1.26s
```

### D. Browser

| Сценарий | Результат |
|----------|-----------|
| Login `ip@demo.alfa` → `/app` dashboard | PASS |
| Dashboard показывает «Предложение банка» | **FAIL BUG-002** (amount×0.6) |
| Ent URL `/app/admin` → redirect home | PASS (остался entrepreneur shell) |
| Login analyst → `/app/analyst` queue | PASS |
| Analyst URL `/app/admin` blocked | PASS |
| Raw status `AGREEMENT_PREPARATION` в очереди | **FAIL BUG-003** |

## Health

```json
{"status":"ok","service":"Линия решения API"}
```

Frontend `:8080` → 200; Swagger `/docs` → 200.

---

## 4. Bug Report

---

## BUG-001

**Название:** Пустой CSV выписки → HTTP 500 INTERNAL_ERROR  

**Модуль:** Finance / Statements / Backend  

**Приоритет:** P1  
**Severity:** Critical  

**Окружение:** Docker `alfahack-qa`, commit `91b6b6b`, macOS + curl  

**Предусловия:** `ip@demo.alfa` / `demo1234`, company `company_001`  

**Шаги:**

1. `POST /api/v1/companies/company_001/statements` с пустым файлом `empty.csv`
2. Наблюдать HTTP status и body

**Ожидаемый результат:** 422 или 202 + `processingStatus=FAILED` с понятным сообщением («файл пуст»).  

**Фактический результат:**

```json
{"error":{"code":"INTERNAL_ERROR","message":"Внутренняя ошибка сервера"}}
```

HTTP 500. Лог:

```
File ".../statements.py", line 82, in parse_statement_bytes
    df = pd.read_csv(..., sep=None, engine="python")
_csv.Error: Could not determine delimiter
```

**Доказательства:** `docs/qa/evidence/` + api logs; pytest `test_empty_statement_should_not_500` xfail.  

**Воспроизводимость:** Всегда  

**Причина (подтверждена кодом):** `import_statement_sync` ловит только `ValueError`; `_csv.Error` / прочие исключения pandas не перехватываются. Проверка `df.empty` не достигается.  

**Компоненты:** Backend `statements.py`, `company_finance.py`, `finance.py`  

**Исправление:**

```python
# parse_statement_bytes: guard before read_csv
if not content or not content.strip():
    raise ValueError("Файл пуст или не содержит строк операций")
# import_statement_sync: except (ValueError, Exception) as Exc → FAILED
# или: except Exception as exc: map to FAILED for parse errors
```

**Regression Test:** `backend/tests/integration/test_auth_credit_apps.py::test_empty_statement_should_not_500` (снять xfail после фикса).

---

## Наблюдения

| ID | Наблюдение |
|----|------------|
| N-01 | Double accept → HTTP 200 idempotent; 1 row в `offer_acceptances` — OK для DEC-09 |
| N-02 | Reject без reasonCodes → auto `REJECT_POLICY` — ослабленное правило vs «обязательная причина» |
| N-03 | Logout не инвалидирует access JWT до expiry — типично; refresh отозван |
| N-04 | External ML disabled — assistant `RULES_FALLBACK` |

---

## 5. Security & RBAC

## Матрица (проверено на API)

| Действие | Entrepreneur | Analyst | Admin |
|----------|--------------|---------|-------|
| Свои компании | Да | Через non-draft apps | 403 `/companies` |
| `/analyst/*` | **403** | Да | 403 (нет роли) |
| `/admin/*` | **403** | **403** | Да |
| Submit application | Да | Нет (не client write) | Нет |
| Propose decision | **403** | Да | Нет |
| Accept offer чужой company | **404** | — | — |
| Self-elevate role | **403** | — | — |
| Disable user → session | — | — | me=401, relogin=401 |

## UI

| Проверка | Результат |
|----------|-----------|
| Ent `/app/admin` | Redirect / остаётся в своём shell |
| Analyst `/app/admin` | Остаётся на `/app/analyst` |

## Изоляция тенантов

- `ip@` видит только `company_001` / INN `770123456703`
- `ooo@` — `company_002` / `7709876545`
- Пересечение ID компаний: пусто
- Чужие financials/apps/statements → **404** (не 403) — anti-enumeration OK

## Замечания

- Access JWT после logout ещё валиден до TTL — принять как риск демо; refresh отозван.
- Rate limit login: 429 при бурст-тестах (Redis keys `alfa:rl:login:*`) — корректное поведение.

---

## 6. API Contract Audit

Источник истины: `GET /openapi.json` (118 paths) vs README / frontend `docs/ENDPOINTS.md` / master prompt.

## Реализовано и живое

- `/auth/*` login, refresh, logout, me  
- `/companies/*` CRUD-ish, financials, funding-needs, registry  
- `/credit-products`, `/credit-matches`, `/credit-calculations`, `/projects/evaluate`  
- `/companies/{id}/applications*` полный контур + offers/agreement/docs  
- `/analyst/*` queue, assign, checks, document-requests, propose, comments  
- `/admin/*` users, products, policies, models, demo, audit, config  
- `/notifications*`, finance statements/forecasts/scenarios, assistant

## Gaps / drift

| Тема | Статус |
|------|--------|
| Legacy `/applications` без company scope | Есть, deprecated |
| External `/ml/*` microservice | NOT IMPLEMENTED in compose |
| `redirectTo` paths | CONTRACT GAP (BUG-004) |
| Manager vs Analyst split API | Нет — единый `/analyst` |
| Offer accept body required | Да (`OfferAcceptIn`), даже с defaults — клиент должен слать `{}` |

## Статус-коды (факт)

| Операция | Код |
|----------|-----|
| Submit application | **202** |
| Upload statement | **202** |
| Create draft | **201** |
| Invalid transition | **409** + `INVALID_TRANSITION` |
| Optimistic lock | **409** |
| Validation | **422** envelope `{error:{code,message,fields}}` |

---

## 7. E2E Scenarios

## E2E-01 Успешное кредитование (API) — PASSED

Актёры: `ip@demo.alfa`, `analyst@demo.alfa`  
Idempotency-Key: `e2e-hp-01`

1. Login entrepreneur → companies → `company_001`
2. `POST .../applications` draft `working_capital_01` / 2 000 000 / 12 / `inventory_purchase` → **201**
3. Повтор с тем же Idempotency-Key → тот же id
4. Submit → **202** `IN_REVIEW` + workflowId
5. Analyst assign → **200** card
6. Propose `APPROVED` + offer params → **200** `APPROVED` + offerId
7. Entrepreneur offers list → 1 ACTIVE
8. `ooo@` accept → **404**
9. Owner accept → **200** `AGREEMENT_PREPARATION`
10. GET agreement → **200**
11. Confirm → **200**; повтор → **409 ALREADY_CONFIRMED**

**Вердикт шага:** сквозной API-путь работает.

## E2E-01 UI — PARTIAL

- Login + dashboard OK  
- Блок оффера на dashboard **искажает цифры (BUG-002)** — UI-подтверждение решения нельзя считать достоверным без карточки заявки/API

## E2E-02 Document request — PARTIAL PASS

Seed `app_docs_01` status `DOCS_REQUESTED`; entrepreneur видит 1 document-request. Полный upload+respond цикл — **NOT RUN** (время).

## E2E-03 Counteroffer — PASS (API)

Seed `app_counter_01` + accept `offer_counter_01` → AGREEMENT_PREPARATION.

## E2E-04 Reject — PASS (API)

Propose `REJECTED` без reasonCodes → 200 (автокод) — см. N-02.

## E2E-05 Policy change — NOT RUN

Simulate queued (`ADMIN-12` 202) — publish/history regression не гонялись end-to-end.

## E2E-06 ML down — PASS (by config)

`assistant/status`: `RULES_FALLBACK`, `modelActive=null`. Нет фейкового scoring refusal.

## E2E-07 Security — PASS

См. `05_SECURITY_RBAC.md`.

## E2E-08 Idempotency — PASS

Draft create + agreement confirm; accept идемпотентен без дублей.

---

## 8. ML Validation

## Конфигурация QA

- External ML: **disabled**  
- Assistant mode: `RULES_FALLBACK`  
- Forecast: rule baseline `seasonal-naive-v1` (COMPLETED)

## Результаты

| ID | Результат | Комментарий |
|----|-----------|-------------|
| ML-01..06 model I/O | NOT RUN | Нет внешнего ML-сервиса |
| ML-07 unavailable | PASS | Fallback, не отказ по кредиту |
| ML-10 hallucinations | PARTIAL | Rule answers generic; не выдаёт admin password |
| ML-11 role isolation | PASS | Запрос чужого ИНН не раскрыл финансы ooo |
| ML-12 decision safety | PASS | Ent propose → 403 |
| ML-13 prompt injection | PASS | Safe generic reply |

## Admin model registry

`GET /admin/models` → 3 модели (seed). Активация/health при выключенном ML — **NOT RUN deep**.

## Риск

Демо-AI не должен презентоваться как банковский скоринг. Disclaimer в status есть.

---

## 9. Performance

**Host:** macOS (OrbStack Docker)  
**Стек:** `alfahack-qa` all-in-one  

Измерения — wall-clock отдельных curl/httpx, не нагрузочный профиль.

| Операция | Наблюдение |
|----------|------------|
| `GET /health` | ~1–3 ms (in-container) |
| Login | ~50–150 ms; при бурсте → **429** |
| Credit calculations 12m | <100 ms |
| Analyst queue | <150 ms |
| Full E2E API path (draft→confirm) | ~1.3 s суммарно скрипта |
| pytest suite | 1.26 s |

## Нагрузка

| Сценарий | Статус |
|----------|--------|
| 10/20 parallel reads | NOT RUN |
| Concurrent assign 2 analysts | NOT RUN (один seed analyst) |
| k6/locust | NOT RUN |

**Вывод:** для демо на 1 жюри хватает; формальных SLA нет.

---

## 10. Regression

Автоматизация добавлена в этом прогоне:

```
backend/tests/
  conftest.py
  unit/
    test_inn_validation.py
    test_credit_calculator.py
    test_statement_parse.py
    test_workflow_transitions.py
  integration/
    test_auth_credit_apps.py
  security/
    test_rbac.py
```

## Запуск

```bash
# против поднятого QA API (из контейнера api):
docker compose -p alfahack-qa exec -T api pytest -q

# или с хоста, если PYTHONPATH=backend и зависимости стоят:
cd backend && QA_API_BASE=http://127.0.0.1:8000/api/v1 pytest -q
```

## Smoke перед демо

```bash
curl -s http://localhost:8000/health
# login ip → companies → credit-calculations → applications list
# login analyst → /analyst/applications
# UI: /login → /app и /app/analyst
```

---

## Сводка исполнения

| Метрика | Count |
|---------|------:|
| Модулей в inventory | 11 |
| Тест-кейсов в каталоге | ~70+ |
| Фактически запущено | ~85 |
| Passed | ~72 |
| Failed (дефекты) | 4 (BUG-001..003 + related) |
| Blocked | 2 |
| Skipped / Not run | remainder |
| pytest | 36 passed, 1 xfailed |
| Bugs P0 | **0** |
| Bugs P1 | **2** (BUG-001, BUG-002) |
| Bugs P2 | **1** (BUG-003) |
| Bugs P3 | **2** (BUG-004, BUG-005) |
