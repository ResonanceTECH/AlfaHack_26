# test/ — QA package «Линия решения»

Единая папка всех проведённых автотестов и отчёта.

| Путь | Тип |
|------|-----|
| `unit/` | Unit (INN, калькулятор, parser, workflow) |
| `integration/` | Integration API |
| `contract/` | OpenAPI contract |
| `security/` | RBAC / isolation |
| `e2e/` | End-to-end credit path |
| `exploratory/` | Негатив / exploratory |
| `performance/` | Latency + parallel reads |
| `accessibility/` | Базовый a11y smoke |
| `evidence/` | JSON/лог прогонов |
| **`Test.md`** | Полный QA-отчёт (все бывшие `docs/qa/*.md`) |

## Запуск

```bash
# стек
docker compose -p alfahack-qa up -d

# все автотесты (из контейнера api удобнее для unit с app.*)
docker cp ./test/. alfahack-qa-api-1:/app/test_suite
docker compose -p alfahack-qa exec -T api \
  sh -c 'cd /app && PYTHONPATH=/app pytest /app/test_suite -q --ignore=/app/test_suite/accessibility'
```

Или с хоста (нужен `pip install -r backend/requirements.lock` + живой API):

```bash
cd test && QA_API_BASE=http://127.0.0.1:8000/api/v1 pytest -q
```
