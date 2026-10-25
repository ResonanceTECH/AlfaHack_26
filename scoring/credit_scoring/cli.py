"""python -m credit_scoring.cli personas | generate --n 200 --seed 42 --out data"""
import argparse
import json
from pathlib import Path

from .engine import score
from .generator import generate_batch, personas
from .models import to_jsonable


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("personas")
    g = sub.add_parser("generate")
    g.add_argument("--n", type=int, default=200)
    g.add_argument("--seed", type=int, default=42)
    g.add_argument("--out", default="data")
    args = ap.parse_args()

    if args.cmd == "personas":
        for p in personas():
            r = score(p.input)
            o = r.offer
            offer = f"{o.amount:,.0f} / {o.term_months} мес / {o.annual_rate:.0%}" if o else "-"
            mark = "ok" if r.decision.value == p.expected_decision else "MISMATCH"
            print(f"{p.id:14} {r.decision.value:14} score={r.score} band={r.risk_band} "
                  f"complete={r.score_complete} offer_score={r.offer_score} "
                  f"offer_band={r.offer_risk_band} {offer}  [{mark}]")
        return

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "personas.json").write_text(json.dumps(
        [{"id": p.id, "title": p.title, "expected_decision": p.expected_decision, "input": to_jsonable(p.input)}
         for p in personas()], ensure_ascii=False, indent=2), encoding="utf-8")
    with open(out / "applications.jsonl", "w", encoding="utf-8") as f:
        for inp in generate_batch(args.n, args.seed):
            f.write(json.dumps(to_jsonable(inp), ensure_ascii=False) + "\n")
    print(f"written to {out}/")


if __name__ == "__main__":
    main()
