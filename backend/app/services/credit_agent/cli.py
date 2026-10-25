"""Демо агента без БД: python -m app.services.credit_agent.cli --help."""
import argparse
import json
import os
import sys
from pathlib import Path

from credit_scoring import score, to_jsonable
from credit_scoring.generator import personas
from . import AgentConfig, catalog_context, scoring_context, verified_changes, run_agent


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Разъяснения и подбор продуктов на синтетических данных")
    parser.add_argument("mode", choices=["client", "analyst", "question", "select"])
    parser.add_argument("--persona", default="ambitious", choices=[p.id for p in personas()])
    parser.add_argument("--question", default="")
    parser.add_argument("--catalog", help="JSON-массив опубликованных продуктов для режима select")
    parser.add_argument("--llm", action="store_true", help="Вызвать локальную LLM; иначе шаблон")
    parser.add_argument("--base-url", default=os.getenv("LLM_BASE_URL", "http://127.0.0.1:8081/v1"))
    parser.add_argument("--model", default=os.getenv("LLM_MAIN", "Qwen3-4B-Instruct-2507"))
    parser.add_argument("--timeout", type=float, default=float(os.getenv("LLM_TIMEOUT_SECONDS", "20")))
    args = parser.parse_args()
    if args.mode == "select":
        if not args.catalog:
            parser.error("Для select укажите --catalog с JSON-каталогом")
        context = catalog_context(json.loads(Path(args.catalog).read_text(encoding="utf-8")), question=args.question)
    else:
        inp = next(p.input for p in personas() if p.id == args.persona)
        result = to_jsonable(score(inp))
        context = scoring_context(result, analyst=args.mode == "analyst", question=args.question,
                                  simulations=verified_changes(inp, result))
    config = AgentConfig(enabled=args.llm, base_url=args.base_url, llm_main=args.model,
                         llm_light=os.getenv("LLM_LIGHT", args.model), api_key=os.getenv("LLM_API_KEY", ""),
                         timeout_seconds=args.timeout)
    run = run_agent(context, config)
    print(json.dumps(run.response.model_dump(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
