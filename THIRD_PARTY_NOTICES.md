# Сторонние компоненты скоринга и агента

Этот реестр описывает компоненты нашей части проекта. Полный реестр ранее
созданных frontend/backend требуется дополнить команде перед сдачей.

| Компонент | Версия / назначение | Лицензия / источник |
| --- | --- | --- |
| PyYAML | 6.0.3, конфигурация скоринга | MIT, https://github.com/yaml/pyyaml |
| Pydantic | 2.10.4, контракты и проверка JSON | MIT, https://github.com/pydantic/pydantic |
| HTTPX | 0.28.1, HTTP-клиент локальной LLM | BSD-3-Clause, https://github.com/encode/httpx |
| pytest | 8.3.4, тесты | MIT, https://github.com/pytest-dev/pytest |
| setuptools | 75.6.0, сборка пакета скоринга | MIT, https://github.com/pypa/setuptools |
| Qwen3-4B-Instruct-2507 | Опциональные открытые веса, не включены в репозиторий | Apache-2.0, https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507 |
| GGUF Qwen3-4B-Instruct-2507 от Unsloth | Опциональная квантизация UD-Q4_K_XL; не скачана и не включена | Apache-2.0 по карточке, https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF |
| llama.cpp | Опциональный локальный inference-server; конкретная сборка пока не проверена | MIT, https://github.com/ggml-org/llama.cpp |

Версии установленных зависимостей backend закреплены requirements.lock.
Перед воспроизводимой сдачей с LLM необходимо записать выбранные ревизии
сервера, GGUF и SHA256. Платные API для агента не используются.

Данные компаний, финансов, кредитной истории и налогового статуса синтетические.
БКИ и ФНС — структуры генератора/seed, без подключения к внешним источникам.
Реестр компаний локальный синтетический. Подписание и выдача моделируются.
Тестовые HTTP-ответы LLM создаются командой; сторонние датасеты не добавлены.
