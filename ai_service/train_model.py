from __future__ import annotations

import argparse
import csv
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import joblib
from sklearn.metrics import accuracy_score, classification_report

from model_utils import build_model_input, create_estimator, suggest_reason_codes


DEFAULT_DATASET_PATH = Path(__file__).resolve().parent / "data" / "electronic_audit_dataset.csv"
DEFAULT_HARD_DATASET_PATH = Path(__file__).resolve().parent / "data" / "electronic_audit_hard_cases.csv"
DEFAULT_MODEL_PATH = Path(__file__).resolve().parent / "audit_model.pkl"
VALID_LABELS = {"PASS", "REVIEW", "FAIL"}
VALID_SPLITS = {"train", "val", "test"}


def load_dataset(dataset_path: Path, allowed_splits: set[str] | None = None) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    expected_splits = allowed_splits or VALID_SPLITS

    with dataset_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for line_number, row in enumerate(reader, start=2):
            label = str(row.get("audit_label", "")).strip().upper()
            split = str(row.get("split", "train")).strip().lower() or "train"

            if label not in VALID_LABELS:
                raise ValueError(f"Invalid audit_label on line {line_number}: {label!r}")
            if split not in expected_splits:
                raise ValueError(f"Invalid split on line {line_number}: {split!r}")

            feature_row = build_model_input(row, row.get("report_text"))
            rows.append(
                {
                    "sample_id": row.get("sample_id", f"line-{line_number}"),
                    "split": split,
                    "label": label,
                    "reason_codes": row.get("reason_codes", ""),
                    "features": feature_row,
                }
            )

    if not rows:
        raise ValueError(f"No rows found in dataset: {dataset_path}")

    return rows


def evaluate_split(model, records: list[dict[str, object]], split_name: str) -> None:
    if not records:
        print(f"{split_name}: no rows")
        return

    features = [record["features"] for record in records]
    labels = [record["label"] for record in records]
    predictions = model.predict(features)

    print(f"\n{split_name} accuracy: {accuracy_score(labels, predictions):.3f}")
    print(classification_report(labels, predictions, digits=3, zero_division=0))


def preview_predictions(model, records: list[dict[str, object]]) -> None:
    print("\nSample predictions:")
    for record in records[:5]:
        feature_row = record["features"]
        label = model.predict([feature_row])[0]
        probabilities = {}
        if hasattr(model, "predict_proba"):
            probabilities = dict(
                zip(model.classes_, model.predict_proba([feature_row])[0].tolist())
            )
        print(
            f"- {record['sample_id']}: expected={record['label']} predicted={label} "
            f"pass_probability={probabilities.get('PASS', 0.0):.3f} "
            f"reason_hints={suggest_reason_codes(feature_row)}"
        )


def train(dataset_path: Path, model_path: Path, hard_dataset_path: Path | None = None) -> None:
    rows = load_dataset(dataset_path)
    split_counts = Counter(str(row["split"]) for row in rows)
    label_counts = Counter(str(row["label"]) for row in rows)

    train_rows = [row for row in rows if row["split"] == "train"]
    val_rows = [row for row in rows if row["split"] == "val"]
    test_rows = [row for row in rows if row["split"] == "test"]

    if not train_rows:
        raise ValueError("Dataset must include at least one train row")

    model = create_estimator()
    model.fit(
        [row["features"] for row in train_rows],
        [row["label"] for row in train_rows],
    )

    print(f"Loaded dataset: {dataset_path}")
    print(f"Split counts: {dict(split_counts)}")
    print(f"Label counts: {dict(label_counts)}")

    evaluate_split(model, train_rows, "train")
    evaluate_split(model, val_rows, "val")
    evaluate_split(model, test_rows, "test")
    if hard_dataset_path and hard_dataset_path.exists():
        hard_rows = load_dataset(hard_dataset_path, allowed_splits={"holdout"})
        print(f"\nLoaded hard holdout dataset: {hard_dataset_path}")
        print(f"Hard label counts: {dict(Counter(str(row['label']) for row in hard_rows))}")
        evaluate_split(model, hard_rows, "hard_holdout")
        preview_predictions(model, hard_rows)
    preview_predictions(model, val_rows or test_rows or train_rows)

    bundle = {
        "model": model,
        "version": "electronic-audit-v2",
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "dataset_path": str(dataset_path),
        "hard_dataset_path": str(hard_dataset_path) if hard_dataset_path else None,
        "split_counts": dict(split_counts),
        "label_counts": dict(label_counts),
        "classes": model.classes_.tolist(),
    }

    joblib.dump(bundle, model_path)
    print(f"\nModel saved to {model_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the electronic audit model from CSV.")
    parser.add_argument("--dataset", default=str(DEFAULT_DATASET_PATH), help="Path to CSV dataset")
    parser.add_argument(
        "--hard-dataset",
        default=str(DEFAULT_HARD_DATASET_PATH),
        help="Path to independent hard holdout CSV dataset",
    )
    parser.add_argument("--output", default=str(DEFAULT_MODEL_PATH), help="Path to output model file")
    return parser.parse_args()


if __name__ == "__main__":
    arguments = parse_args()
    hard_dataset = Path(arguments.hard_dataset) if arguments.hard_dataset else None
    train(Path(arguments.dataset), Path(arguments.output), hard_dataset)
