# Запуск перенесённой копии на Linux

Архив содержит исходники и текущие локальные изменения, включая скоринг и агента.
Windows-окружение Python, node_modules, кеши, реальные .env и история Git исключены.
Веса LLM и бинарник inference-сервера в архив не входят.

## 1. Приложение в браузере

Установите Docker Engine и плагин Docker Compose. Проверьте:

```bash
docker --version
docker compose version
```

Распакуйте архив и откройте терминал в папке AlfaHack_26, рядом с docker-compose.yml:

```bash
docker compose up --build db redis api web
```

Сервис UI в Compose называется `web` (порт 8080). При первом запуске нужен интернет для образов и зависимостей.
По умолчанию LLM отключена, объяснения формируются шаблонами.

Откройте:

- http://localhost:8080 — кабинет;
- http://localhost:8000/docs — Swagger для проверки скоринга и агента;
- http://localhost:8000/health — доступность API.

Учётные записи, пароль для всех demo1234:

| Логин | Назначение |
| --- | --- |
| ip@demo.alfa | Клиент company_001 |
| ooo@demo.alfa | Клиент company_002 |
| analyst@demo.alfa | Аналитик |
| admin@demo.alfa | Администратор |

Backend автоматически применяет миграции и заполняет синтетические данные.
Проверяйте скоринг на новой отправленной заявке, а не только на seed-заявках.
Начните с working_capital_01, суммы 1000000 и срока 12 месяцев; затем попробуйте
9000000 и 24 месяца для встречного предложения.

В Swagger выполните POST /api/v1/auth/login:

```json
{"login":"ip@demo.alfa","password":"demo1234"}
```

Создайте заявку через POST /companies/company_001/applications:

```json
{
  "productId": "working_capital_01",
  "requestedAmount": "1000000",
  "termMonths": 12,
  "purpose": "Закупка товаров",
  "goalType": "inventory_purchase"
}
```

С идентификатором из ответа вызовите POST
/companies/company_001/applications/{application_id}/submit.
Затем POST /applications/{application_id}/ai/explanation с телом:

```json
{"question":"Почему предложены такие условия?"}
```

Все эти пути имеют префикс /api/v1. В режиме без модели ответ содержит mode=template.
Для подбора используйте POST /companies/company_001/ai/product-selection:

```json
{"question":"Нужны деньги на закупку товаров","amount":2500000,"termMonths":24}
```

Экран AI-чата frontend пока вызывает другой адрес /ai/chat и содержит готовый
демо-диалог. Новый агент надёжно проверяется через Swagger. Ручки нового агента
возвращают структурированный JSON, а не отдельный готовый экран.

Логи и остановка с сохранением данных:

```bash
docker compose logs --tail=100 api
docker compose down
```

Не используйте down -v, если хотите сохранить БД и загруженные файлы.

## 2. Проверка тестами без Docker

Нужен Python 3.11+, для полного backend рекомендуется 3.12.
На Linux создайте новое окружение, Windows-окружение переносить нельзя:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.lock
python -m pip install -e ./scoring
python -m pytest -q
```

На исходной машине прошли 116 тестов. HTTP/LLM/PostgreSQL в тестах частично
заменены заглушками; это не проверка производительности живой модели.

Для демонстрации без БД:

```bash
python -m credit_scoring.cli personas
cd backend
python -m app.services.credit_agent.cli client --persona ambitious
python -m app.services.credit_agent.cli analyst --persona bki_down
```

## 3. Настоящая локальная LLM

Сначала проверьте приложение без модели. Затем следуйте
[инструкции агента](backend/app/services/credit_agent/README.md): там указаны
модель Qwen3-4B-Instruct-2507, запуск llama-server, CLI и переменные окружения.
Живой инференс на исходной машине не проверялся; успешный вызов должен вернуть
mode=llm и пустой validation_errors.

Для Docker на Linux укажите LLM_BASE_URL с адресом, доступным контейнеру.
host.docker.internal может требовать дополнительной настройки. Для теста
через локальный Python используйте http://127.0.0.1:8081/v1.

Веса скачиваются отдельно. Измерения RAM и скорости зависят от ноутбука.
