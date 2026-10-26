# ML-модуль: скоринг и агент разъяснений

Модуль оценивает синтетические кредитные заявки, рассчитывает условия предложения
и объясняет результат клиенту или аналитику. Агент также помогает подобрать
продукт из опубликованного каталога и заполнить параметры заявки.

**Решение принимает детерминированная экспертная скоркарта. LLM получает готовые
факты и формулирует ответ. Если модель отключена или её ответ не проходит
проверки, используются шаблоны.**

Локальный запуск Qwen и AI-сценарии вручную проверены пользователем на Linux
x86_64. Формальная оценка качества, скорости и потребления RAM пока не проводилась.

## Состав модуля

Пути указаны от корня репозитория.

| Компонент                                | Путь                                         |
|------------------------------------------|----------------------------------------------|
| Ядро, входные и выходные контракты       | `scoring/credit_scoring/`                    |
| Правила, веса и политика продуктов       | `scoring/credit_scoring/config/scoring.yaml` |
| Восемь демо-персон и генератор синтетики | `scoring/credit_scoring/generator.py`        |
| Подключение к обработке заявки           | `backend/app/services/scoring.py`            |
| Контекст, LLM-клиент, проверки и шаблоны | `backend/app/services/credit_agent/`         |
| Авторизация, каталог и аудит агента      | `backend/app/services/agent_service.py`      |
| HTTP-ручки агента                        | `backend/app/api/v1/credit_agent.py`         |
| Тесты                                    | `scoring/tests/`, `backend/tests/`           |

### Структура каталога `scoring/`

```
scoring/
|-- README.md
|-- INTEGRATION.md
|-- pyproject.toml
|-- requirements.txt
|-- credit_scoring/
|   |-- __init__.py
|   |-- models.py          # ScoringInput / Result
|   |-- engine.py          # скоркарта и политика
|   |-- config.py
|   |-- config/scoring.yaml
|   |-- generator.py       # демо-персоны / синтетика
|   `-- cli.py
|-- data/                  # personas.json, applications.jsonl
`-- tests/
```

Связанные куски backend (не в этом каталоге): `backend/app/services/scoring.py`,
`backend/app/services/credit_agent/`, `backend/app/api/v1/credit_agent.py`.
Общий обзор репо: [../README.md](../README.md).

Ядро - чистая функция без сети, БД и LLM. При отправке заявки backend собирает
вход, вызывает ядро и сохраняет решение, факторы и оффер в существующие модели БД.
При запросе объяснения сервер проверяет доступ, готовит факты и при необходимости
пересчитывает варианты параметров тем же ядром. Только после этого вызывается LLM.

## Как устроен скоринг

Версия политики - **2026.2-draft**, пакет - **0.2.0**.

Последовательность: наличие обязательных данных -> стоп-правила -> скоркарта ->
политика продукта. База - 500 баллов. Восемь факторов: возраст бизнеса, динамика
выручки, маржа, долговая нагрузка, сумма к выручке, количество и длительность
просрочек, отрасль. Уровни: A >= 600, B >= 520, C >= 440, иначе D.

Общая оценка применяется к working_capital, overdraft, equipment и express;
условия различаются политикой. Общий штраф истории ограничен -60 через YAML,
динамика не применяется к бизнесу младше года. Диапазон на согласованных полных
данных - 220-685. Веса экспертные, модель на синтетике не обучалась.

| Решение ядра  | Статус backend |
|---------------|----------------|
| approved      | APPROVED       |
| counter_offer | COUNTEROFFERED |
| request_data  | DOCS_REQUESTED |
| manual_review | IN_REVIEW      |
| rejected      | REJECTED       |

Вход ScoringInput содержит компанию, заявку, дату оценки и синтетические блоки
egrul, financials, bki, fns. Суммы - рубли, сроки - месяцы; ставка ядра задаётся
долей: 0.19 означает 19%. В адаптере она переводится в проценты для оффера.

Результат содержит решение, причины, правила и версию политики.
score/risk_band/factors относятся к исходному запросу, а
offer/offer_score/offer_risk_band/offer_factors - к предложенным условиям.
Оффер переоценивается до устойчивых условий без увеличения суммы и срока
кандидата. score_complete=false означает отсутствие хотя бы одного блока источников.
Неполные оценки нельзя ранжировать вместе с полными.

Точные контракты: [models.py](credit_scoring/models.py).
Формат синтетических сведений и хранение результатов:
[INTEGRATION.md](INTEGRATION.md).

## Запуск модели и приложения на Linux

Все команды Compose выполняются **из корня проекта**, где находятся
docker-compose.yml и [compose.llm.yml](../compose.llm.yml).
Нужны Docker Engine, Compose и интернет для первой загрузки.

Проверенная модель - **Qwen3-4B-Instruct-2507, GGUF Q4_K_M**, примерно 2,5 ГБ.
Дополнительно нужна RAM для контекста и вычислений. Около 6 ГБ доступной памяти -
практический запас для первого теста, а не измеренный минимум. Перед запуском
закройте ненужные приложения; проверить ресурсы можно через `free -h` и `df -h`.

### 1. Скачать веса один раз

```bash
mkdir -p "$HOME/llm-models"

curl -fL --retry 10 --connect-timeout 30 \
  -o "$HOME/llm-models/Qwen3-4B-Instruct-2507-Q4_K_M.gguf" \
  "https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q4_K_M.gguf"

ls -lh "$HOME/llm-models/"
```

Веса остаются в домашнем каталоге, вне Git. Источники:
[модель Qwen](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507),
[GGUF Unsloth](https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF).
Модель имеет открытые веса Apache-2.0 и работает без thinking.

### 2. Поднять сервер и backend

```bash
docker compose -p alfahack_26 \
  -f docker-compose.yml -f compose.llm.yml \
  up -d --build db redis llm api
```

Дополнение compose.llm.yml запускает официальный CPU-образ llama.cpp и передаёт
настройки в api. Отдельно устанавливать Ollama или llama-server не требуется.

Если приложение уже работает и меняется только подключение модели, используйте
ту же команду с `up -d llm api`, без пересборки. Для существующего Docker-проекта
с другим именем замените alfahack_26 его именем, чтобы использовать прежнюю БД.

Для UI запустите также frontend или web, смотря какой сервис есть в вашей версии:
`docker compose config --services`. В локальной копии оба занимают порт 8080,
поэтому запускать нужно только один. Для проверки ML-модуля достаточно Swagger.

### 3. Дождаться готовности

```bash
docker compose -p alfahack_26 \
  -f docker-compose.yml -f compose.llm.yml logs --tail=100 -f llm
```

После строк `model loaded` и `listening` выполните в другом терминале:

```bash
curl http://localhost:8081/health
```

Ожидается `{"status":"ok"}`. Ctrl+C прекращает просмотр логов, а не контейнер.
Swagger: http://localhost:8000/docs. UI, если запущен: http://localhost:8080.

### Какие настройки уже заданы

| Параметр                             | Значение                           |
|--------------------------------------|------------------------------------|
| Модель и alias                       | Qwen3-4B-Instruct-2507             |
| Файл                                 | Qwen3-4B-Instruct-2507-Q4_K_M.gguf |
| CPU-потоки / параллельные запросы    | 4 / 1                              |
| Размер контекста                     | 8192 токена                        |
| LLM_ENABLED                          | true                               |
| LLM_BASE_URL для api                 | http://llm:8080/v1                 |
| LLM_MAIN / LLM_LIGHT                 | Qwen3-4B-Instruct-2507             |
| LLM_TIMEOUT_SECONDS / LLM_MAX_TOKENS | 120 / 900                          |
| LLM_API_KEY                          | Пустое значение                    |

Ключ не нужен: локальный сервер запущен без авторизации. MAIN и LIGHT используют
одну модель, чтобы не занимать память двумя экземплярами. Порт сервера доступен
на хосте только через loopback; backend обращается к модели по сети Compose.

Если backend запущен напрямую через Python, а модель - в Docker, укажите
в backend/.env `LLM_BASE_URL=http://127.0.0.1:8081/v1` и остальные LLM-настройки
из таблицы. Внутри контейнера api адрес localhost использовать нельзя:
он указывает на сам api, а не на сервер модели.

### Повторный запуск и остановка

После настройки продолжайте использовать **оба** Compose-файла:

```bash
docker compose -p alfahack_26 \
  -f docker-compose.yml -f compose.llm.yml up -d db redis llm api

# Остановка с сохранением данных:
docker compose -p alfahack_26 \
  -f docker-compose.yml -f compose.llm.yml down
```

Для обычного перезапуска не нужен down -v: он удаляет volumes, включая БД.
Файл GGUF в домашнем каталоге сохраняется, поскольку подключён каталогом хоста.

## Проверка через Swagger

Авторизация: POST **/api/v1/auth/login**, логин ip@demo.alfa, пароль demo1234.
Если требуется, вставьте access-токен в Authorize без дополнительного слова Bearer.
Для аналитика используйте analyst@demo.alfa с тем же паролем.

1. GET **/api/v1/assistant/status** должен вернуть LLM_CONFIGURED.
   Это подтверждает настройку, но ещё не успешную генерацию.
2. Создайте заявку через POST **/api/v1/companies/company_001/applications**:

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

3. Скопируйте id и выполните POST
   **/api/v1/companies/company_001/applications/{id}/submit**. Ожидается APPROVED.
4. Вызовите POST **/api/v1/applications/{id}/ai/explanation**:

```json
{"question":"Почему по заявке принято такое решение?"}
```

Успешный вызов модели определяется по полям, а не по стилю текста:

```json
{
  "mode": "llm",
  "model": "Qwen3-4B-Instruct-2507",
  "validation_errors": []
}
```

Уже отправленные заявки можно найти через GET
/api/v1/companies/company_001/applications. Старые seed-заявки могут не содержать
результата нашего ядра. В новой заявке на **9 млн ₽ / 24 месяца** ожидается
COUNTEROFFERED и предложение меньшей суммы.

### Остальные AI-функции

Все пути ниже имеют префикс /api/v1 и требуют авторизации:

| Функция          | Запрос и пример тела                                                                                       |
|------------------|------------------------------------------------------------------------------------------------------------|
| Вопрос по заявке | POST /applications/{id}/ai/chat - `{"question":"Как повлияла долговая нагрузка?"}`                         |
| Подбор продукта  | POST /companies/{id}/ai/product-selection - `{"question":"Нужен станок","amount":2500000,"termMonths":24}` |
| Оценка ответа    | POST /ai/responses/{response_id}/feedback - `{"helpful":true,"comment":"Понятно"}`                         |

Для сводки аналитика используется та же explanation: роль определяет backend.
Вопрос о погоде должен получить ответ об отсутствии сведений; template для него допустим.

Ответ агента использует **snake_case**: summary, main_reasons, what_to_change,
next_steps, product_ids, prefill, response_id, mode, model, prompt_version,
validation_errors, score_complete, disclaimer. Причины имеют source_id, scope
и при наличии factor_id/rule_id/product_id. Исходный запрос и оффер объясняются
отдельно. Советы по изменению параметров основаны на пересчётах ядра.

## Если вместо LLM пришёл шаблон

mode=template - резервный режим, а не обязательно ошибка. Проверьте:

- LLM_CONFIGURED в /assistant/status и успешный /health сервера;
- что api запущен с compose.llm.yml и адресом http://llm:8080/v1;
- validation_errors и логи api/llm при сетевом сбое или отклонении генерации.

На сетевую ошибку есть один повтор; неверный JSON, неизвестные ссылки, выдуманные
числа или нарушение ограничений включают шаблон. Без модели основной сценарий
работает полностью; основной Compose по умолчанию использует LLM_ENABLED=false.

## Тесты и запуск без Docker

Из корня проекта, Python 3.11+; для backend рекомендуется 3.12:

```bash
python -m venv .venv
source .venv/bin/activate
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
python -m pip install --timeout 120 --retries 10 -r backend/requirements.lock
python -m pip install -e ./scoring
python -m pytest -q
python -m credit_scoring.cli personas
```

Последний проверенный прогон - **116 тестов**. Есть проверки ядра, согласованности,
адаптера, HTTP, доступа и ошибок LLM. Модель и БД в части тестов заменены заглушками.
Это отдельная проверка от ручного запуска настоящих весов.

Демо агента без БД и модели, из активированного окружения:

```bash
cd backend
python -m app.services.credit_agent.cli client --persona ambitious
python -m app.services.credit_agent.cli analyst --persona bki_down
# Вызов запущенной модели через опубликованный порт:
python -m app.services.credit_agent.cli client --persona ambitious --llm --timeout 120
```

Воспроизвести синтетику из корня:
`python -m credit_scoring.cli generate --n 200 --seed 42 --out scoring/data`.

## Что отправлять в GitHub с рабочего устройства

Проверка модели выполнялась на отдельном Linux-ноутбуке, а push выполняется
с рабочего устройства. Настройки между ними автоматически не синхронизируются.
Известные изменения запуска перенесены в эту копию репозитория:

| Файл                                         | Что в нём сохранено                                                                             |
|----------------------------------------------|-------------------------------------------------------------------------------------------------|
| `compose.llm.yml`                            | Qwen Q4_K_M, каталог весов, порты, 4 CPU-потока, контекст 8192 и один параллельный запрос       |
| `compose.llm.yml`, секция api                | LLM_ENABLED=true, адрес http://llm:8080/v1, имена модели, таймаут 120, 900 токенов, пустой ключ |
| `backend/Dockerfile`                         | Таймаут pip 120 секунд и 10 повторов для зависимостей и установки scoring                       |
| `scoring/README.md`                          | Скачивание весов, запуск, проверка и повторный запуск                                           |
| `THIRD_PARTY_NOTICES.md`                     | Модель, квантизация и используемый inference-server                                             |
| `frontend/docs/SCORING_AGENT_INTEGRATION.md` | Задачи подключения frontend                                                                     |

Ранее исправленные ошибки сборки frontend также должны оставаться в ветке scoring.
Основной Compose и backend/.env.example сохраняют шаблонный режим по умолчанию;
для настоящей модели используется дополнение compose.llm.yml. Менять личный
.env или включать LLM для всех запусков ради коммита не требуется.

Из корня проекта на устройстве, с которого отправляются изменения:

```bash
git switch scoring
git status
git diff
git add backend/Dockerfile compose.llm.yml scoring/README.md THIRD_PARTY_NOTICES.md frontend/docs/SCORING_AGENT_INTEGRATION.md
git diff --cached --stat
git diff --cached
git commit -m "Настроен и проверен локальный LLM-агент"
git push -u origin scoring
```

Перед коммитом проверьте список файлов. Push отправляет только коммиты:
неотслеживаемый compose.llm.yml без `git add` в GitHub не попадёт. Если есть
другие нужные изменения, добавьте их отдельно после просмотра.

Не отправляйте личные .env, ключи, GGUF-веса, виртуальные окружения и node_modules.
Веса скачиваются по инструкции; Compose на каждом компьютере использует его
собственный HOME. Неизвестные изменения с Linux-ноутбука нужно отдельно сверить
перед переносом - доступ к его файловой системе у этой рабочей копии отсутствует.

## Воспроизводимость и ограничения

Зафиксируйте SHA256 скачанных весов и digest использованного образа:

```bash
sha256sum "$HOME/llm-models/Qwen3-4B-Instruct-2507-Q4_K_M.gguf"
docker image inspect ghcr.io/ggml-org/llama.cpp:server --format '{{json .RepoDigests}}'
```

Тег server обновляемый; проверенный digest следует закрепить перед сдачей.
Сейчас значения digest и SHA256 с тестового ноутбука ещё не записаны в репозиторий.
[Лицензии и источники](../THIRD_PARTY_NOTICES.md).

- Все сведения синтетические. Реальных подключений к БКИ/ФНС нет. Веса экспертные,
  распределение исходов не является метрикой качества. Овердрафт считается аннуитетом.
- В каталоге backend есть investment/credit_line, которых нет в ядре. Требуется
  явное eligibility_rules.scoring_product; без связи заявка идёт аналитику.
  Условия каталога и политики также требуют согласования.
- Связь нового API с frontend остаётся задачей команды интерфейса. Текущий чат
  использует /ai/chat; есть демо-ответы и резервные карточки. Таймаут frontend
  15 секунд нужно согласовать с CPU-инференсом.
- Проверки текста эвристические, не доказывают истинность каждой фразы. Разбор
  намерений ограничен ключевыми словами; RAG и свободного планирования tools нет.
- Живой запуск проверен вручную, но количественных оценок качества и скорости нет.
  Автотесты не заменяют проверку реальных транзакций PostgreSQL.

