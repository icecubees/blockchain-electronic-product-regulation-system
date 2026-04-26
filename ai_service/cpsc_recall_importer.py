from __future__ import annotations

import argparse
import csv
import json
import re
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen


API_ENDPOINT = "https://www.saferproducts.gov/RestWebServices/Recall"
OUTPUT_PATH = Path(__file__).resolve().parent / "data" / "cpsc_recall_fail_samples.csv"
DEFAULT_QUERIES = [
    "charger",
    "power bank",
    "portable charger",
    "lithium battery",
    "phone",
    "cell phone charger",
    "tablet",
    "laptop",
    "laptop battery",
    "computer",
    "tablet battery",
    "camera",
    "router",
    "power adapter",
    "headphones",
    "earbuds",
    "smart watch",
    "camera battery",
]

FIELDNAMES = [
    "sample_id",
    "split",
    "category",
    "name",
    "description",
    "brand",
    "model",
    "serial_number",
    "batch_no",
    "is_used",
    "is_refurbished",
    "battery_health",
    "accessory_status",
    "ccc_number",
    "energy_level",
    "rohs_status",
    "inspection_agency",
    "inspection_conclusion",
    "battery_safety_passed",
    "charger_safety_passed",
    "appearance_grade",
    "functional_test_passed",
    "repair_history_declared",
    "report_text",
    "risk_level",
    "audit_label",
    "reason_codes",
]

CATEGORY_KEYWORDS = [
    ("power_bank", ["power bank", "portable charger", "battery pack", "magnetic wireless charger"]),
    ("charger", ["charger", "power adapter", "power supply", "adapter", "charging"]),
    ("mobile_phone", ["cell phone", "mobile phone", "smartphone", "iphone"]),
    ("tablet", ["tablet", "ipad"]),
    ("laptop", ["laptop", "notebook", "computer"]),
    ("earphone", ["earbud", "earphone", "headphone", "headset"]),
    ("smart_watch", ["smart watch", "smartwatch", "watch"]),
    ("camera", ["camera"]),
    ("router", ["router", "modem", "wi-fi", "wifi"]),
]

REASON_RULES = [
    (
        "battery_safety_concern",
        [
            "battery",
            "lithium",
            "overheat",
            "fire",
            "burn",
            "ignite",
            "explosion",
            "explode",
            "electric shock",
            "electrocution",
            "smoke",
        ],
    ),
    ("suspected_counterfeit", ["counterfeit", "unauthorized", "fake"]),
    ("report_model_mismatch", ["model mismatch", "wrong model", "incorrect model"]),
]

ELECTRONIC_SIGNAL_KEYWORDS = [
    "adapter",
    "battery",
    "cable",
    "charger",
    "charging",
    "computer",
    "electric",
    "electrical",
    "electronic",
    "laptop",
    "lithium",
    "phone",
    "power",
    "router",
    "tablet",
    "usb",
    "wi-fi",
    "wifi",
    "wireless",
]

NON_ELECTRONIC_TABLET_KEYWORDS = [
    "acetaminophen",
    "allergy",
    "aspirin",
    "blister pack",
    "capsule",
    "cold and flu",
    "cough",
    "dietary supplement",
    "drug",
    "gummy",
    "ibuprofen",
    "medicine",
    "medication",
    "multivitamin",
    "pharmaceutical",
    "pill",
    "supplement",
    "tablet bottle",
    "vitamin",
]

TABLET_ELECTRONIC_DISAMBIGUATORS = [
    "android",
    "battery",
    "charger",
    "charging",
    "computer",
    "electronic",
    "ipad",
    "lcd",
    "screen",
    "touchscreen",
    "usb",
    "wi-fi",
    "wifi",
]


def compact_text(value: Any) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text


def first_non_empty(values: list[str]) -> str:
    for value in values:
        normalized = compact_text(value)
        if normalized:
            return normalized
    return ""


def flatten_names(items: list[dict[str, Any]], key: str = "Name") -> list[str]:
    if not isinstance(items, list):
        return []
    return [compact_text(item.get(key, "")) for item in items if isinstance(item, dict)]


def fetch_query(query: str, timeout: int) -> list[dict[str, Any]]:
    params = urlencode({"format": "json", "ProductName": query})
    request = Request(
        f"{API_ENDPOINT}?{params}",
        headers={"User-Agent": "electronic-regulation-ai-dataset/1.0"},
    )
    with urlopen(request, timeout=timeout) as response:
        payload = response.read().decode("utf-8")
    data = json.loads(payload)
    return data if isinstance(data, list) else []


def infer_category(text: str) -> str:
    lowered = text.lower()
    for category, keywords in CATEGORY_KEYWORDS:
        if any(contains_keyword(lowered, keyword) for keyword in keywords):
            return category
    return "accessory"


def contains_keyword(lowered_text: str, keyword: str) -> bool:
    escaped = re.escape(keyword).replace(r"\ ", r"\s+")
    if escaped.endswith("y"):
        escaped = escaped[:-1] + r"(?:y|ies)"
    elif re.search(r"[a-z0-9]$", escaped):
        escaped = escaped + r"(?:s|es)?"
    pattern = r"(?<![a-z0-9])" + escaped + r"(?![a-z0-9])"
    return re.search(pattern, lowered_text, flags=re.IGNORECASE) is not None


def infer_brand(recall: dict[str, Any], product_name: str) -> str:
    company_sources = (
        flatten_names(recall.get("Manufacturers", []))
        + flatten_names(recall.get("Importers", []))
        + flatten_names(recall.get("Distributors", []))
    )
    company = first_non_empty(company_sources)
    if company:
        return re.split(r",|\sof\s| dba ", company, flags=re.IGNORECASE)[0].strip()

    product_match = re.match(r"([A-Z][A-Za-z0-9&.\-]+)", product_name)
    return product_match.group(1) if product_match else ""


def infer_model(text: str) -> str:
    patterns = [
        r"model(?:\s+number)?\s+[\"']?([A-Za-z0-9][A-Za-z0-9_.\-\/]{1,24})",
        r"model[:\s]+([A-Za-z0-9][A-Za-z0-9_.\-\/]{1,24})",
        r"\b([A-Z]{1,5}[- ]?\d{2,6}[A-Z0-9_.\-]*)\b",
    ]
    stopwords = {
        "the",
        "this",
        "that",
        "number",
        "name",
        "front",
        "and",
        "back",
        "side",
        "product",
        "unit",
        "units",
    }
    for pattern in patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            candidate = match.group(1).strip().strip(".,;:()[]{}\"'")
            if re.match(r"^(the|a|an|and)\s+", candidate, flags=re.IGNORECASE):
                continue
            candidate = re.sub(r"^(the|a|an|and)\s+", "", candidate, flags=re.IGNORECASE).strip()
            if not candidate or candidate.lower() in stopwords:
                continue
            if candidate.isalpha() and candidate.islower():
                continue
            if not any(character.isdigit() for character in candidate) and len(candidate) <= 5:
                continue
            return candidate
    return ""


def infer_reason_codes(category: str, source_text: str, model: str) -> str:
    lowered = source_text.lower()
    reasons: list[str] = []
    if category in {"charger", "power_bank"}:
        reasons.append("missing_ccc_information")
    if category in {"mobile_phone", "tablet"} and not model:
        reasons.append("missing_device_identifier")
    for code, keywords in REASON_RULES:
        if any(keyword in lowered for keyword in keywords):
            reasons.append(code)
    return "|".join(dict.fromkeys(reasons))


def split_for_index(index: int) -> str:
    bucket = index % 10
    if bucket < 7:
        return "train"
    if bucket < 9:
        return "val"
    return "test"


def normalize_recall(recall: dict[str, Any], index: int) -> dict[str, str]:
    products = recall.get("Products", []) if isinstance(recall.get("Products", []), list) else []
    product_names = flatten_names(products)
    product_types = flatten_names(products, "Type")
    hazards = flatten_names(recall.get("Hazards", []))
    injuries = flatten_names(recall.get("Injuries", []))
    remedies = flatten_names(recall.get("Remedies", []))

    title = compact_text(recall.get("Title"))
    description = compact_text(recall.get("Description"))
    product_name = first_non_empty(product_names + [title])
    source_text = " ".join(
        part
        for part in [
            title,
            product_name,
            " ".join(product_types),
            description,
            " ".join(hazards),
            " ".join(injuries),
            " ".join(remedies),
        ]
        if part
    )
    category = infer_category(source_text)
    brand = infer_brand(recall, product_name)
    model = infer_model(source_text)
    reason_codes = infer_reason_codes(category, source_text, model)
    recall_number = compact_text(recall.get("RecallNumber"))
    recall_date = compact_text(recall.get("RecallDate")).split("T")[0]
    url = compact_text(recall.get("URL"))

    report_parts = [
        f"CPSC recall {recall_number} published {recall_date}." if recall_number else "",
        f"Title: {title}" if title else "",
        f"Product: {product_name}" if product_name else "",
        f"Hazard: {' '.join(hazards)}" if hazards else "",
        f"Incidents/Injuries: {' '.join(injuries)}" if injuries else "",
        f"Remedy: {' '.join(remedies)}" if remedies else "",
        f"Source: {url}" if url else "",
    ]
    report_text = " ".join(part for part in report_parts if part)

    has_battery_hazard = "battery_safety_concern" in reason_codes
    is_charger_like = category in {"charger", "power_bank", "accessory"}
    recall_id = compact_text(recall.get("RecallID")) or str(index)

    return {
        "sample_id": f"CPSC-{recall_id}",
        "split": split_for_index(index),
        "category": category,
        "name": product_name[:120],
        "description": title[:240] or description[:240],
        "brand": brand[:100],
        "model": model[:100],
        "serial_number": "",
        "batch_no": recall_number,
        "is_used": "false",
        "is_refurbished": "false",
        "battery_health": "45" if has_battery_hazard and category != "charger" else "",
        "accessory_status": "unknown",
        "ccc_number": "",
        "energy_level": "unknown",
        "rohs_status": "unknown",
        "inspection_agency": "U.S. Consumer Product Safety Commission",
        "inspection_conclusion": "fail",
        "battery_safety_passed": "false" if has_battery_hazard else "",
        "charger_safety_passed": "false" if is_charger_like or has_battery_hazard else "",
        "appearance_grade": "",
        "functional_test_passed": "false",
        "repair_history_declared": "",
        "report_text": report_text,
        "risk_level": "high",
        "audit_label": "FAIL",
        "reason_codes": reason_codes,
    }


def is_relevant_electronic_row(row: dict[str, str]) -> bool:
    lowered = " ".join(
        [row.get("name", ""), row.get("description", ""), row.get("report_text", "")]
    ).lower()

    if row["category"] == "tablet" and any(
        contains_keyword(lowered, keyword) for keyword in NON_ELECTRONIC_TABLET_KEYWORDS
    ):
        return any(
            contains_keyword(lowered, keyword) for keyword in TABLET_ELECTRONIC_DISAMBIGUATORS
        )

    if row["category"] != "accessory":
        return True

    return any(contains_keyword(lowered, keyword) for keyword in ELECTRONIC_SIGNAL_KEYWORDS)


def collect_recalls(queries: list[str], max_rows: int, timeout: int, delay: float) -> list[dict[str, Any]]:
    recalls_by_id: dict[str, dict[str, Any]] = {}
    for query in queries:
        for recall in fetch_query(query, timeout):
            recall_id = compact_text(recall.get("RecallID"))
            if recall_id:
                recalls_by_id.setdefault(recall_id, recall)
        if delay > 0:
            time.sleep(delay)
    recalls = sorted(
        recalls_by_id.values(),
        key=lambda item: compact_text(item.get("RecallDate")),
        reverse=True,
    )
    return recalls[:max_rows]


def write_csv(rows: list[dict[str, str]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import CPSC recall records as FAIL audit samples.")
    parser.add_argument("--output", default=str(OUTPUT_PATH), help="Output CSV path")
    parser.add_argument("--max-rows", type=int, default=240, help="Maximum deduplicated recall rows")
    parser.add_argument("--timeout", type=int, default=30, help="HTTP timeout in seconds")
    parser.add_argument("--delay", type=float, default=0.2, help="Delay between API queries")
    parser.add_argument(
        "--query",
        action="append",
        dest="queries",
        help="CPSC ProductName query. Can be passed multiple times.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    queries = args.queries or DEFAULT_QUERIES
    recalls = collect_recalls(queries, args.max_rows * 3, args.timeout, args.delay)
    rows: list[dict[str, str]] = []
    for index, recall in enumerate(recalls, start=1):
        row = normalize_recall(recall, index)
        if is_relevant_electronic_row(row):
            rows.append(row)
        if len(rows) >= args.max_rows:
            break
    write_csv(rows, Path(args.output))
    print(f"Imported {len(rows)} CPSC recall rows -> {args.output}")


if __name__ == "__main__":
    main()
