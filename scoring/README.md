# Скоринг и агент разъяснений для кредитного конвейера МСП

Модуль оценивает синтетическую заявку, рассчитывает условия кредита и объясняет
результат клиенту или аналитику. Агент также помогает выбрать продукт из каталога
и подготовить параметры заявки. **Решение принимает экспертная скоркарта; LLM
работает с готовыми фактами. Без модели доступен шаблонный резерв.**

## Архитектура

```text
Отправка заявки → валидация backend → адаптер → score(input, config)
                                              ↓
                                решение, факторы и оффер → БД и аудит
                                              ↓
Запрос объяснения → проверка доступа → факты и preview → LLM → проверка ответа
                                                           ↘ шаблон
```

Пути от корня репозитория:

| Компонент | Путь | Назначение |
| --- | --- | --- |
| Ядро | `scoring/credit_scoring/` | Контракты dataclasses, чистая функция score, валидация конфига |
| Политика | `scoring/credit_scoring/config/scoring.yaml` | Веса, стоп-правила, уровни риска и условия продуктов |
| Синтетика | `scoring/credit_scoring/generator.py` | Восемь персон и генератор с фиксированным seed |
| Адаптер | `backend/app/services/scoring.py` | Сбор входа, вызов ядра, решения и офферы в БД |
| Агент | `backend/app/services/credit_agent/` | Контекст, LLM-клиент, проверки, шаблоны и CLI |
| Сервис и API | `backend/app/services/agent_service.py`, `backend/app/api/v1/credit_agent.py` | Доступ, каталог, HTTP и аудит |
| Тесты | `scoring/tests/`, `backend/tests/` | Ядро, согласованность данных, интеграция и агент |

Ядро не обращается к сети, БД или LLM и не изменяет вход. Адаптер использует
существующие JSON-поля backend, без новых миграций.

## Скоринг и контракты

Версия политики — **2026.2-draft**, пакет — **0.2.0**.
Вход `ScoringInput`: компания, параметры заявки, дата оценки, синтетические
`egrul`, `financials`, `bki`, `fns`. Суммы — рубли, сроки — месяцы;
годовая ставка ядра — доля: `0.19` означает 19%.

Порядок обработки: обязательные данные → стоп-правила → скоркарта → политика
продукта. К базе 500 добавляются восемь факторов: возраст, рост выручки, маржа,
долговая нагрузка, сумма к выручке, число и длительность просрочек, отрасль.
Уровни: **A ≥ 600, B ≥ 520, C ≥ 440, иначе D**.

Общая скоркарта применяется к четырём продуктам: `working_capital`, `overdraft`,
`equipment`, `express`; различие условий задаётся политикой. После аудита общий
штраф истории просрочек ограничен −60 через YAML, динамика не применяется
к бизнесу младше года. Согласованный полный диапазон — **220–685**.
Вход проверяется на некорректные суммы, противоречивые просрочки и будущую регистрацию.

Оффер переоценивается на предложенных сумме и сроке до устойчивых условий.
Проверка не увеличивает сумму/срок кандидата и не ищет глобально максимальный оффер.
Фактор суммы сохранён осознанно: он оценивает масштаб запроса, политика ограничивает
условия продукта. Веса экспертные, статистическая модель не обучалась.

| Решение ядра | Статус заявки |
| --- | --- |
| `approved` | `APPROVED` |
| `counter_offer` | `COUNTEROFFERED` |
| `request_data` | `DOCS_REQUESTED` |
| `manual_review` | `IN_REVIEW` |
| `rejected` | `REJECTED` |

Результат содержит решение, причины, правила, недостающие данные и версию конфига.
`score/risk_band/factors` описывают **исходный запрос**,
`offer/offer_score/offer_risk_band/offer_factors` — **предложенные условия**.
`points` — фактический вклад фактора, `raw_points` — исходный при групповой коррекции.
База плюс сумма вкладов равна скору.

`score_complete=false` означает отсутствие хотя бы одного из четырёх блоков источников.
Неполную оценку нельзя ранжировать вместе с полной; неприменимость динамики по возрасту допустима.
Точные поля: [models.py](credit_scoring/models.py).
Формат `FinancialSnapshot.metrics.scoring`, преобразования и хранение:
[спецификация адаптера](INTEGRATION.md).

## Запуск и проверки

Команды выполняются **из корня репозитория**, рядом с docker-compose.yml.
Для ядра нужен Python 3.11+, для полного backend рекомендуется 3.12.
Зависимости backend зафиксированы в requirements.lock.

```bash
python -m venv .venv
source .venv/bin/activate
# Windows PowerShell вместо предыдущей строки:
# .\.venv\Scripts\Activate.ps1
python -m pip install --timeout 120 --retries 10 -r backend/requirements.lock
python -m pip install -e ./scoring
python -m pytest -q
python -m credit_scoring.cli personas
```

Последний проверенный прогон — **116 тестов**. Проверяются восемь персон,
согласованность скора и оффера, интеграция, доступ, HTTP и сбои LLM.
БД и модель в части тестов заменены заглушками; скачивать веса для тестов не нужно.

Демо агента без БД и модели, с активированным окружением:

```bash
cd backend
python -m app.services.credit_agent.cli client --persona ambitious
python -m app.services.credit_agent.cli analyst --persona bki_down
python -m app.services.credit_agent.cli question --persona overdue --question "Почему отказ?"
python -m app.services.credit_agent.cli select --catalog app/services/credit_agent/example_catalog.json --question "Нужен станок: 2,5 млн на 24 месяца"
```

CLI-каталог — фикстура, рабочий каталог хранится в БД. Воспроизведение синтетики
из корня: `python -m credit_scoring.cli generate --n 200 --seed 42 --out scoring/data`.

### Приложение в Docker и ручная проверка

```bash
docker compose up --build db redis api frontend
```

Сервисы перечислены явно: frontend и web пока занимают одинаковый порт.
Backend применяет миграции и seed. UI: http://localhost:8080,
Swagger: http://localhost:8000/docs. Логины: `ip@demo.alfa`, `ooo@demo.alfa`,
`analyst@demo.alfa`; пароль — `demo1234`.

В Swagger авторизуйтесь через POST /api/v1/auth/login. Создайте **новую** заявку
через POST /api/v1/companies/company_001/applications:

```json
{
  "fundingNeedId": null,
  "productId": "working_capital_01",
  "requestedAmount": "1000000",
  "termMonths": 12,
  "purpose": "Закупка товаров",
  "goalType": "inventory_purchase"
}
```

Вызовите POST /api/v1/companies/company_001/applications/{id}/submit.
Ожидается APPROVED; для отдельной заявки на 9 млн ₽ / 24 месяца — COUNTEROFFERED.
Проверьте условия через GET той же заявки с суффиксом /offers и объяснение
через API ниже. Старые seed-заявки могут не содержать результата нашего ядра.
Перенос на Linux: [RUN_LINUX.md](../RUN_LINUX.md).

## Агент: API и настройка LLM

Четыре задачи: объяснение клиенту, сводка аналитику, вопросы по заявке и подбор
продукта. Доступ и роль определяет backend до вызова модели. Клиент получает
направление влияния факторов, аналитик — значения и баллы. Советы об изменении
заявки строятся по пересчётам ядра. Старое решение не пересчитывается для советов,
если версия текущего YAML уже отличается.

Все пути имеют префикс **/api/v1** и требуют авторизации:

| Метод и путь | Тело |
| --- | --- |
| POST /applications/{id}/ai/explanation | `{}` или `{"question":"Почему такие условия?"}` |
| POST /applications/{id}/ai/chat | `{"question":"Почему предложили меньшую сумму?"}` |
| POST /companies/{id}/ai/product-selection | `{"question":"Нужен станок","amount":2500000,"termMonths":24}` |
| POST /ai/responses/{response_id}/feedback | `{"helpful":true,"comment":"Понятно"}` |

Ответ использует **snake_case**: `response_id`, `summary`, `main_reasons`,
`what_to_change`, `next_steps`, `product_ids`, `prefill`, `mode`, `model`,
`prompt_version`, `validation_errors`, `score_complete`, `disclaimer`.
Причины содержат `source_id`, `scope` и при наличии `factor_id/rule_id/product_id`.
Для роли ANALYST ручка explanation возвращает полный разбор.

Backend-диалоги /companies/{id}/assistant/conversations/{id}/messages тоже используют
модуль: с `applicationId` объясняют заявку, без него подбирают продукт.
Параметры подбора сохраняются между сообщениями; полная история в LLM не отправляется.
Аудит хранит версию промпта, модель, подготовленный вход, сырой ответ, проверки
и итог. Обратная связь связана с response_id.

По умолчанию **LLM_ENABLED=false**. Для локального сервера с совместимым
/v1/chat/completions и JSON Schema задайте в backend/.env:

```dotenv
LLM_ENABLED=true
LLM_BASE_URL=http://127.0.0.1:8081/v1
LLM_MAIN=Qwen3-4B-Instruct-2507
LLM_LIGHT=Qwen3-4B-Instruct-2507
LLM_TIMEOUT_SECONDS=60
LLM_MAX_TOKENS=900
LLM_API_KEY=
```

Для Compose переменные задаются в оболочке или корневом .env; адрес должен быть
доступен контейнеру. 127.0.0.1 внутри api означает сам контейнер.

Опциональная модель — [Qwen3-4B-Instruct-2507](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507),
открытые веса Apache-2.0, без thinking. После установки
[llama.cpp](https://github.com/ggml-org/llama.cpp/tree/master/tools/server)
пример запуска с загрузкой [GGUF Unsloth](https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF):

```bash
llama-server -hf unsloth/Qwen3-4B-Instruct-2507-GGUF:UD-Q4_K_XL --alias Qwen3-4B-Instruct-2507 --port 8081 --host 127.0.0.1 --threads 8 --ctx-size 8192
# В другом терминале, из backend с активированным окружением:
python -m app.services.credit_agent.cli client --persona ambitious --llm --timeout 60
```

`mode=llm` с пустым validation_errors означает прошедший проверки ответ модели.
`mode=template` — резерв; при отключённой модели ошибок может не быть.
Сетевой сбой даёт один повтор; неверный JSON, ссылки, числа или нарушение
ограничений включают шаблон. Для сдачи с LLM нужно зафиксировать сборку сервера,
ревизию и SHA256 весов. Веса не включены в репозиторий.
[Сторонние компоненты](../THIRD_PARTY_NOTICES.md).

## Ограничения и оставшаяся интеграция

- Все данные синтетические, bki и fns — структуры генератора/seed. Внешних подключений
  нет. Распределение решений не является метрикой качества. Овердрафт считается аннуитетом.
- В каталоге backend есть investment и credit_line, которых нет в ядре. Нужно явное
  `eligibility_rules.scoring_product`; без него заявка идёт аналитику. Диапазоны
  каталога и YAML тоже требуют согласования.
- Frontend ещё вызывает /ai/chat, содержит демо-ответы и резервные карточки.
  Новый агент проверяется через Swagger. Объяснения, офферы и роль ANALYST нужно
  связать с UI; таймаут клиента 15 секунд согласовать с CPU-инференсом.
  Три найденные ошибки сборки frontend исправлены отдельно.
- Проверки текста эвристические, не доказывают истинность каждой фразы. Разбор
  намерений ограничен ключевыми словами; нет RAG и свободного планирования tools.
  Подбор учитывает цель, сумму и срок, а не кредитоспособность.
- Живые веса LLM, качество формулировок, скорость и RAM пока не проверены.
  Автотесты с заглушками не заменяют проверку модели и транзакций PostgreSQL.

