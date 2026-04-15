from __future__ import annotations

from typing import Any

from sklearn.feature_extraction import DictVectorizer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.preprocessing import FunctionTransformer


FIELD_ALIASES = {
    "name": ["name"],
    "description": ["description"],
    "brand": ["brand"],
    "model": ["model"],
    "category": ["category"],
    "serial_number": ["serial_number", "serialNumber"],
    "batch_no": ["batch_no", "batchNo"],
    "is_used": ["is_used", "isUsed"],
    "is_refurbished": ["is_refurbished", "isRefurbished"],
    "battery_health": ["battery_health", "batteryHealth"],
    "accessory_status": ["accessory_status", "accessoryStatus"],
    "ccc_number": ["ccc_number", "cccNumber"],
    "energy_level": ["energy_level", "energyLevel"],
    "rohs_status": ["rohs_status", "rohsStatus"],
    "inspection_agency": ["inspection_agency", "inspectionAgency"],
    "inspection_conclusion": ["inspection_conclusion", "inspectionConclusion"],
    "battery_safety_passed": ["battery_safety_passed", "batterySafetyPassed"],
    "charger_safety_passed": ["charger_safety_passed", "chargerSafetyPassed"],
    "appearance_grade": ["appearance_grade", "appearanceGrade"],
    "functional_test_passed": ["functional_test_passed", "functionalTestPassed"],
    "repair_history_declared": ["repair_history_declared", "repairHistoryDeclared"],
    "report_text": ["report_text", "reportText"],
}

CATEGORICAL_FIELDS = [
    "category",
    "brand",
    "model",
    "accessory_status",
    "energy_level",
    "rohs_status",
    "inspection_agency",
    "inspection_conclusion",
    "appearance_grade",
]

BOOLEAN_FIELDS = [
    "is_used",
    "is_refurbished",
    "battery_safety_passed",
    "charger_safety_passed",
    "functional_test_passed",
    "repair_history_declared",
]

NUMERIC_FIELDS = ["battery_health"]


def _first_value(payload: dict[str, Any] | None, field_name: str, default: Any = "") -> Any:
    if not isinstance(payload, dict):
        return default

    for alias in FIELD_ALIASES.get(field_name, [field_name]):
        if alias in payload and payload[alias] not in (None, ""):
            return payload[alias]
    return default


def normalize_string(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def normalize_boolean(value: Any) -> str:
    if value is None or value == "":
        return "unknown"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return "true" if value != 0 else "false"

    lowered = str(value).strip().lower()
    if lowered in {"true", "1", "yes", "y", "on"}:
        return "true"
    if lowered in {"false", "0", "no", "n", "off"}:
        return "false"
    return "unknown"


def normalize_integer(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def build_model_input(payload: dict[str, Any] | None = None, extracted_text: str | None = None) -> dict[str, Any]:
    record = {
        "name": normalize_string(_first_value(payload, "name")),
        "description": normalize_string(_first_value(payload, "description")),
        "brand": normalize_string(_first_value(payload, "brand")),
        "model": normalize_string(_first_value(payload, "model")),
        "category": normalize_string(_first_value(payload, "category")),
        "serial_number": normalize_string(_first_value(payload, "serial_number")),
        "batch_no": normalize_string(_first_value(payload, "batch_no")),
        "is_used": normalize_boolean(_first_value(payload, "is_used", None)),
        "is_refurbished": normalize_boolean(_first_value(payload, "is_refurbished", None)),
        "battery_health": normalize_integer(_first_value(payload, "battery_health", None)),
        "accessory_status": normalize_string(_first_value(payload, "accessory_status")),
        "ccc_number": normalize_string(_first_value(payload, "ccc_number")),
        "energy_level": normalize_string(_first_value(payload, "energy_level")),
        "rohs_status": normalize_string(_first_value(payload, "rohs_status")),
        "inspection_agency": normalize_string(_first_value(payload, "inspection_agency")),
        "inspection_conclusion": normalize_string(_first_value(payload, "inspection_conclusion")),
        "battery_safety_passed": normalize_boolean(_first_value(payload, "battery_safety_passed", None)),
        "charger_safety_passed": normalize_boolean(_first_value(payload, "charger_safety_passed", None)),
        "appearance_grade": normalize_string(_first_value(payload, "appearance_grade")),
        "functional_test_passed": normalize_boolean(_first_value(payload, "functional_test_passed", None)),
        "repair_history_declared": normalize_boolean(_first_value(payload, "repair_history_declared", None)),
        "report_text": normalize_string(_first_value(payload, "report_text")),
    }

    report_text = normalize_string(extracted_text)
    if report_text:
        record["report_text"] = report_text

    return record


def build_text_corpus(rows: list[dict[str, Any]]) -> list[str]:
    documents: list[str] = []
    for row in rows:
        record = build_model_input(row)
        parts = [
            f"category {record['category']}",
            f"name {record['name']}",
            f"brand {record['brand']}",
            f"model {record['model']}",
            f"description {record['description']}",
            f"inspection {record['inspection_conclusion']}",
            f"report {record['report_text']}",
            f"ccc_present {'yes' if record['ccc_number'] else 'no'}",
            f"serial_present {'yes' if record['serial_number'] else 'no'}",
            f"used {record['is_used']}",
            f"refurbished {record['is_refurbished']}",
            f"repair_history {record['repair_history_declared']}",
            f"battery_safety {record['battery_safety_passed']}",
            f"charger_safety {record['charger_safety_passed']}",
        ]
        documents.append(" ".join(part for part in parts if part.strip()))
    return documents


def build_structured_features(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    features: list[dict[str, Any]] = []
    for row in rows:
        record = build_model_input(row)
        item: dict[str, Any] = {
            "has_serial_number": 1 if record["serial_number"] else 0,
            "has_batch_no": 1 if record["batch_no"] else 0,
            "has_ccc_number": 1 if record["ccc_number"] else 0,
            "has_report_text": 1 if record["report_text"] else 0,
            "description_length": len(record["description"]),
            "report_length": len(record["report_text"]),
        }

        for field_name in CATEGORICAL_FIELDS:
            item[field_name] = record[field_name] or "unknown"

        for field_name in BOOLEAN_FIELDS:
            item[field_name] = record[field_name]

        for field_name in NUMERIC_FIELDS:
            item[field_name] = record[field_name] if record[field_name] is not None else -1

        features.append(item)
    return features


def suggest_reason_codes(payload: dict[str, Any] | None = None, extracted_text: str | None = None) -> list[str]:
    record = build_model_input(payload, extracted_text)
    suggestions: list[str] = []

    if record["category"] in {"charger", "power_bank"} and not record["ccc_number"]:
        suggestions.append("missing_ccc_information")
    if record["category"] in {"mobile_phone", "tablet"} and not record["serial_number"]:
        suggestions.append("missing_device_identifier")
    if record["is_refurbished"] == "true" and record["repair_history_declared"] != "true":
        suggestions.append("undisclosed_refurbished_status")
    if record["battery_safety_passed"] == "false" or record["charger_safety_passed"] == "false":
        suggestions.append("battery_safety_concern")

    return suggestions


def create_estimator() -> Pipeline:
    text_pipeline = Pipeline(
        [
            ("select_text", FunctionTransformer(build_text_corpus, validate=False)),
            (
                "tfidf",
                TfidfVectorizer(
                    analyzer="char",
                    ngram_range=(2, 5),
                    min_df=1,
                    sublinear_tf=True,
                ),
            ),
        ]
    )

    structured_pipeline = Pipeline(
        [
            ("select_structured", FunctionTransformer(build_structured_features, validate=False)),
            ("dict_vectorizer", DictVectorizer(sparse=True)),
        ]
    )

    return Pipeline(
        [
            ("features", FeatureUnion([("text", text_pipeline), ("structured", structured_pipeline)])),
            (
                "classifier",
                LogisticRegression(
                    max_iter=4000,
                    class_weight="balanced",
                ),
            ),
        ]
    )
