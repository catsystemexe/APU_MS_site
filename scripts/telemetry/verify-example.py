"""Independent checks of files actually written by the synthetic CSV generator."""
import csv
import json
import math
from pathlib import Path
import re
import sys

directory = Path(sys.argv[1] if len(sys.argv) > 1 else "work/b3-verified-sample")
with (directory / "telemetry-synthetic-summary.csv").open(newline="") as source:
    rows = list(csv.DictReader(source))
assert len(rows) == 1
row = rows[0]
for key, expected in {"ai_count": 4, "known_cost_nano_usd": 140000000, "complete_ai_sessions_n": 3,
                      "incomplete_mature_sessions": 1, "complete_active_sessions_n": 4, "outputs": 4}.items():
    assert int(row[key]) == expected, key
assert row["complete_cost_nano_usd"] == ""
assert math.isclose(float(row["mean_ai_session_usd"]), 0.14 / 3)
assert float(row["median_ai_session_usd"]) == 0.03
assert float(row["mean_all_active_session_usd"]) == 0.035
for forbidden in ["participant_id", "session_id", "workflow_id", "call_id", "email", "event_json",
                  "projection_json", "prompt", "response", "fingerprint"]:
    assert forbidden not in row, forbidden
for value in row.values():
    assert not re.match(r"^[\s\x00-\x1f]*[=+@-]", value), "unescaped_formula"
assert not re.search(r"PRIVATE|@synthetic|sk-proj-", (directory / "telemetry-synthetic-summary.csv").read_text())
with (directory / "telemetry-synthetic-shared.csv").open(newline="") as source:
    shared = list(csv.DictReader(source))
assert len(shared) == 1 and shared[0]["export_status"] == "suppressed_small_or_complementary_cells"
assert shared[0]["known_cost_nano_usd"] == ""
print("PASS: actual CSV headers, values, unknowns, injection scan, forbidden fields and shared suppression")
print(json.dumps({key: row[key] for key in ["known_cost_nano_usd", "complete_ai_sessions_n", "mean_ai_session_usd", "median_ai_session_usd", "outputs"]}))
