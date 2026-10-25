from credit_scoring.generator import generate_batch, personas
from credit_scoring.models import to_jsonable


def test_same_seed_same_data():
    assert generate_batch(100, seed=7) == generate_batch(100, seed=7)


def test_different_seed_different_data():
    assert generate_batch(100, seed=1) != generate_batch(100, seed=2)


def test_batch_covers_edge_cases():
    batch = generate_batch(1000, seed=42)
    assert any(i.bki is None for i in batch)
    assert any(i.financials is None for i in batch)
    assert any(i.egrul.status != "active" for i in batch if i.egrul)
    assert any(i.financials and i.financials.revenue_prev_12m == 0 for i in batch)


def test_persona_ids_unique_and_json_serializable():
    ids = [p.id for p in personas()]
    assert len(ids) == len(set(ids))
    for p in personas():
        to_jsonable(p.input)
