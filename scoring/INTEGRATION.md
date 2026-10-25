# Интеграция скоринга с заявкой

Основной README модуля: [скоринг и агент разъяснений](README.md).
Этот документ содержит подробности адаптера и хранения данных.

Приоритетный контракт — `credit_scoring.models.ScoringInput` и `ScoringResult`.
Ядро и его YAML не зависят от FastAPI, БД, сети и LLM.

## Подключение

Из корня репозитория в окружении backend:

```powershell
python -m pip install -r backend/requirements.lock
python -m pip install -e ./scoring
python -m pytest -q
```

Docker API собирается из корня репозитория: `docker build -f backend/Dockerfile .`.
Compose использует тот же контекст. Существующий конфликт портов frontend/web
остаётся задачей команды frontend/backend.

`submit_draft` → `run_automated_validation` → `process_scoring` → `score`.
Отсутствие финансов больше не блокирует отправку: ядро возвращает `request_data`.
Остальная предварительная валидация backend (включая диапазоны каталога) сохранена.
Операции выполняются в транзакции вызывающего обработчика, адаптер не делает commit.

## Данные

Компания, дата регистрации, статус, сумма и срок берутся из существующих моделей.
Дополнительные синтетические сведения хранятся в `FinancialSnapshot.metrics.scoring`:

```json
{
  "source": "synthetic-personas-v1",
  "okved_main": "62.01",
  "financials": {"revenue_12m": 24000000, "revenue_prev_12m": 20000000, "expenses_12m": 19680000},
  "bki": {"active_loans": 1, "monthly_payments": 150000, "overdue_now": false, "overdue_count_12m": 0, "max_overdue_days_12m": 0},
  "fns": {"tax_debt": false, "unreliable_info": false}
}
```

Это внутренние данные seed, не новый клиентский HTTP-ввод.
Если блока нет, месячная выручка и расходы умножаются на 12 (демо-оценка),
прошлый период задаётся нулём (динамика не применяется). Пустой ОКВЭД получает
среднюю отраслевую группу по YAML. Отсутствие bki/fns сохраняется как None.
Реальные внешние источники не используются.

`scripts.seed_scoring` дополняет company_001 сведениями персоны ideal,
company_002 — overdue. Финансы сохраняют суммы существующего снимка;
рост 20% и сведения кредитной истории/налогового статуса явно синтетические.
Повторный обычный seed дополняет только отсутствующий блок, без очистки таблиц.

## Каталог и результаты

Продукт определяется по `CreditProduct.eligibility_rules.scoring_product`,
либо по типу заявки, если он совпадает с одним из четырёх продуктов ядра:
working_capital, overdraft, equipment, express.
investment и credit_line автоматически не переименовываются. Без явного
соответствия заявка уходит аналитику с причиной scoring_input_invalid в workflow.
Такое же поведение применяется к структурно некорректному входу адаптера.

| Решение ядра | Статус заявки | Запись CreditDecision |
| --- | --- | --- |
| approved | APPROVED | APPROVED + оффер |
| counter_offer | COUNTEROFFERED | COUNTEROFFERED + оффер |
| rejected | REJECTED | REJECTED |
| request_data | DOCS_REQUESTED | NEED_INFO |
| manual_review | IN_REVIEW | NEED_INFO |

NEED_INFO для ручного рассмотрения — ограничение существующего enum БД.
Исходное решение без потери смысла хранится в `CreditDecision.payload.scoring`.
Ручному рассмотрению не выдаётся активный оффер: предварительные условия
находятся внутри результата скоринга для аналитика.

В `CreditDecision.score` пишется кредитный скор, не readiness_score;
в factors — вклад каждого фактора, в model_version — версия YAML.
payload содержит полный результат и вход для воспроизведения;
workflow.context.scoring содержит результат/диагностику маршрутизации.
В audit log записываются scoring.completed или scoring.input_invalid.
Связь с посторонней версией политики backend для автоматического решения удаляется.
Ставка ядра 0.19 преобразуется в 19 для существующего оффера backend.
Схема БД и существующие DTO сохранены. Объяснения доступны через отдельный API
агента, описанный в [README](README.md).

В 2026.2-draft payload.scoring также содержит score_complete, offer_score,
offer_risk_band и offer_factors. Поля score/risk_band/factors описывают исходную
заявку, поля offer_* — устойчивые предложенные условия. В БД score остаётся
исходным; оффер создаётся по ставке пересчитанного уровня. Неполный скор нельзя
использовать для ранжирования вместе с полным. Эти поля пока доступны во
внутреннем JSON; вывод отдельного предупреждения в UI требует работы коллег.

## Проверки и границы

Тесты интеграции используют настоящий движок, настоящие ORM-модели и замену
Session в памяти: восемь персон, офферы/ставки, повторная валидация,
неподдерживаемый каталог и отсутствие синтетических отчётов.
Они не заменяют проверку commit/rollback и JSONB на PostgreSQL и HTTP e2e.
Агент подключён к отдельным HTTP-ручкам и backend-диалогам; живой инференс LLM
пока не проверен. Без модели работает шаблонный резерв.
