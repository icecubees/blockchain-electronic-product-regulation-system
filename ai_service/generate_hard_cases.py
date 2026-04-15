from __future__ import annotations

import argparse
import csv
import random
from pathlib import Path


OUTPUT_PATH = Path(__file__).resolve().parent / "data" / "electronic_audit_hard_cases.csv"
SEED = 20260415
DEFAULT_TOTAL = 480

CATEGORIES = [
    "mobile_phone",
    "laptop",
    "tablet",
    "earphone",
    "charger",
    "power_bank",
    "smart_watch",
    "camera",
    "router",
    "accessory",
]

CATEGORY_CONFIG = {
    "mobile_phone": ("星河", "曜石", "远航"),
    "laptop": ("灵曜", "极光", "云锋"),
    "tablet": ("云图", "学伴", "星阅"),
    "earphone": ("静听", "音幕", "声澜"),
    "charger": ("稳电", "速充", "闪擎"),
    "power_bank": ("随行", "电量Max", "航电"),
    "smart_watch": ("曜动", "腕航", "智步"),
    "camera": ("影像", "光域", "镜界"),
    "router": ("迅联", "云网", "速域"),
    "accessory": ("原装", "智连", "桥接"),
}

HARD_SCENARIOS = [
    "sparse_but_compliant",
    "contradictory_pass_text",
    "truncated_identifier",
    "seller_claim_conflict",
    "mixed_language_summary",
    "ambiguous_refurbish",
    "partial_safety_signals",
]

REPORT_SNIPPETS = {
    "pass_open": [
        "初检摘要写明样机功能正常，",
        "送检记录第一页显示外观与基本功能合格，",
        "卖家提供的附件摘要称设备可正常使用，",
    ],
    "fail_tail": [
        "但复核页补充说明存在持续发热问题。",
        "但复核结论指出关键证书信息无法核验。",
        "但后续复检备注明确建议暂缓上架。",
    ],
    "review_tail": [
        "最终意见改为建议人工复核后再决定是否放行。",
        "但备注项较多，需要结合附件人工判断。",
        "后页注明可继续流通但必须人工核查披露内容。",
    ],
    "english_tail": [
        "Final note: manual review required before release.",
        "Supplement: model code mismatch observed in appendix.",
        "Thermal retest result remains unstable after 20 cycles.",
    ],
}


def weighted_pick(rng: random.Random, values: tuple[str, ...] | list[str]) -> str:
    return values[rng.randrange(len(values))]


def build_id(category: str, index: int) -> str:
    return f"HC-{category[:3].upper()}-{index:04d}"


def build_row(category: str, index: int, rng: random.Random) -> dict[str, str]:
    brand = weighted_pick(rng, CATEGORY_CONFIG[category])
    model = f"{category[:3].upper()}-{(index % 97) + 3}"
    serial = f"SN-{category[:3].upper()}-{index:06d}"
    ccc_number = f"CCC-{category[:2].upper()}-{index:05d}" if category in {"charger", "power_bank"} else ""
    scenario = HARD_SCENARIOS[index % len(HARD_SCENARIOS)]

    row = {
        "sample_id": build_id(category, index),
        "split": "holdout",
        "category": category,
        "name": f"{brand}{model}",
        "description": f"{brand}{model}电子设备，卖家描述为可正常使用。",
        "brand": brand,
        "model": model,
        "serial_number": serial if category in {"mobile_phone", "tablet", "laptop", "smart_watch", "camera", "router"} else "",
        "batch_no": f"H{2026 + (index % 2)}-{index:04d}",
        "is_used": "false",
        "is_refurbished": "false",
        "battery_health": "91" if category in {"mobile_phone", "tablet", "laptop", "smart_watch", "camera", "earphone", "power_bank"} else "",
        "accessory_status": weighted_pick(rng, ("full", "partial", "none")),
        "ccc_number": ccc_number,
        "energy_level": weighted_pick(rng, ("Level 1", "Level 2", "Level 3")),
        "rohs_status": weighted_pick(rng, ("compliant", "limited", "unknown")),
        "inspection_agency": weighted_pick(rng, ("深圳质检中心", "平台复核", "第三方送检")),
        "inspection_conclusion": "conditional_pass",
        "battery_safety_passed": "true" if category != "charger" else "",
        "charger_safety_passed": "true" if category != "power_bank" else "",
        "appearance_grade": "",
        "functional_test_passed": "true",
        "repair_history_declared": "",
        "report_text": "",
        "risk_level": "medium",
        "audit_label": "REVIEW",
        "reason_codes": "",
    }

    if scenario == "sparse_but_compliant":
        row["report_text"] = "检测页摘要：合格。附页参数正常，建议按常规流程上架。"
        row["inspection_conclusion"] = "pass"
        row["risk_level"] = "low"
        row["audit_label"] = "PASS"
        row["reason_codes"] = ""
        row["accessory_status"] = weighted_pick(rng, ("partial", "full"))
        row["description"] = f"卖家描述较短：{brand}{model}可正常使用。"
    elif scenario == "contradictory_pass_text":
        row["report_text"] = (
            weighted_pick(rng, REPORT_SNIPPETS["pass_open"])
            + weighted_pick(rng, REPORT_SNIPPETS["fail_tail"])
        )
        row["inspection_conclusion"] = "fail"
        row["risk_level"] = "high"
        row["audit_label"] = "FAIL"
        row["reason_codes"] = "battery_safety_concern"
        row["battery_safety_passed"] = "false" if row["battery_safety_passed"] else row["battery_safety_passed"]
        row["charger_safety_passed"] = "false" if row["charger_safety_passed"] else row["charger_safety_passed"]
    elif scenario == "truncated_identifier":
        row["report_text"] = "检测摘录显示功能基本正常，但设备识别码仅保留前半段，需人工核验。"
        row["inspection_conclusion"] = "conditional_pass"
        row["risk_level"] = "medium"
        row["audit_label"] = "REVIEW"
        row["serial_number"] = row["serial_number"][:8] if row["serial_number"] else ""
        row["reason_codes"] = "missing_device_identifier" if row["serial_number"] == "" else ""
    elif scenario == "seller_claim_conflict":
        row["description"] = f"卖家宣称全新未拆封，{row['description']}"
        row["report_text"] = "检测页记录存在拆修痕迹，整机可开机，但销售描述与实物状态不一致。"
        row["is_refurbished"] = "true"
        row["appearance_grade"] = weighted_pick(rng, ("A", "B", "C"))
        row["repair_history_declared"] = "false"
        row["inspection_conclusion"] = "fail"
        row["risk_level"] = "high"
        row["audit_label"] = "FAIL"
        row["reason_codes"] = "undisclosed_refurbished_status"
    elif scenario == "mixed_language_summary":
        row["report_text"] = (
            "Summary: device passed basic checks, "
            + weighted_pick(rng, REPORT_SNIPPETS["english_tail"])
        )
        row["inspection_conclusion"] = "conditional_pass"
        row["risk_level"] = "medium"
        row["audit_label"] = "REVIEW"
    elif scenario == "ambiguous_refurbish":
        row["description"] = f"官方整备机，{row['description']}"
        row["report_text"] = "报告正文未直接写明翻新，仅备注更换外壳与电池，建议人工判断披露是否充分。"
        row["is_refurbished"] = "true"
        row["appearance_grade"] = weighted_pick(rng, ("A", "B"))
        row["repair_history_declared"] = weighted_pick(rng, ("true", "false"))
        row["inspection_conclusion"] = "conditional_pass"
        row["risk_level"] = "medium"
        row["audit_label"] = "REVIEW" if row["repair_history_declared"] == "true" else "FAIL"
        row["reason_codes"] = "" if row["repair_history_declared"] == "true" else "undisclosed_refurbished_status"
    else:
        row["report_text"] = (
            "基础功能通过，但部分安全指标描述模糊，"
            + weighted_pick(rng, REPORT_SNIPPETS["review_tail"])
        )
        row["battery_safety_passed"] = weighted_pick(rng, ("true", "false")) if row["battery_safety_passed"] else row["battery_safety_passed"]
        row["charger_safety_passed"] = weighted_pick(rng, ("true", "false")) if row["charger_safety_passed"] else row["charger_safety_passed"]
        row["inspection_conclusion"] = "conditional_pass"
        row["risk_level"] = "medium"
        row["audit_label"] = "REVIEW"
        if "false" in (row["battery_safety_passed"], row["charger_safety_passed"]):
            row["reason_codes"] = "battery_safety_concern"

    return row


def generate_rows(total_rows: int, seed: int) -> list[dict[str, str]]:
    rng = random.Random(seed)
    per_category = total_rows // len(CATEGORIES)
    remainder = total_rows % len(CATEGORIES)
    rows: list[dict[str, str]] = []
    current_index = 1

    for category_index, category in enumerate(CATEGORIES):
        count = per_category + (1 if category_index < remainder else 0)
        for local_index in range(count):
            rows.append(build_row(category, current_index + local_index, rng))
        current_index += count

    return rows


def write_csv(rows: list[dict[str, str]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
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
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a hard holdout dataset for electronic audit.")
    parser.add_argument("--rows", type=int, default=DEFAULT_TOTAL, help="Total hard-case rows to generate")
    parser.add_argument("--seed", type=int, default=SEED, help="Random seed")
    parser.add_argument("--output", default=str(OUTPUT_PATH), help="Output CSV path")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rows = generate_rows(args.rows, args.seed)
    write_csv(rows, Path(args.output))
    print(f"Generated {len(rows)} hard rows -> {args.output}")


if __name__ == "__main__":
    main()
