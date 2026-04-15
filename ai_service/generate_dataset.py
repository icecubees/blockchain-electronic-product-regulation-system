from __future__ import annotations

import argparse
import csv
import random
from pathlib import Path


OUTPUT_PATH = Path(__file__).resolve().parent / "data" / "electronic_audit_dataset.csv"
DEFAULT_TOTAL = 2400
SEED = 20260415

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
    "mobile_phone": {
        "brands": ["星河", "曜石", "远航", "云际", "澜讯"],
        "models": ["X1", "M5", "Note 12", "K9", "Pro S", "Ultra 7"],
        "name_suffix": "手机",
        "descriptions": ["5G全网通", "快充旗舰", "高刷屏", "长续航", "影像增强"],
        "serial_prefix": "IMEI",
    },
    "laptop": {
        "brands": ["灵曜", "极光", "云锋", "曜越", "铭创"],
        "models": ["Air14", "Game15", "ProBook", "Slim 13", "Creator 16", "Office 15"],
        "name_suffix": "笔记本",
        "descriptions": ["轻薄办公", "独显性能", "商务便携", "长续航", "金属机身"],
        "serial_prefix": "SN-LAP",
    },
    "tablet": {
        "brands": ["云图", "学伴", "星阅", "曜板", "智画"],
        "models": ["Tab11", "T8", "Pad Air", "Edu 10", "Max 12", "S12"],
        "name_suffix": "平板",
        "descriptions": ["学习办公", "大电池", "手写笔支持", "轻薄便携", "护眼屏"],
        "serial_prefix": "SN-TAB",
    },
    "earphone": {
        "brands": ["静听", "音幕", "声澜", "云声", "律动"],
        "models": ["Pro2", "Lite", "Air", "Max", "Go", "Pods X"],
        "name_suffix": "耳机",
        "descriptions": ["降噪蓝牙", "低延迟", "长续航", "原装包装", "运动佩戴"],
        "serial_prefix": "SN-EAR",
    },
    "charger": {
        "brands": ["稳电", "速充", "随配", "能核", "闪擎"],
        "models": ["W45", "FC65", "C20", "Mini 33", "GaN 100", "Fast 67"],
        "name_suffix": "充电器",
        "descriptions": ["氮化镓快充", "多协议兼容", "原装适配", "便携小巧", "高功率输出"],
        "serial_prefix": "SN-CHG",
    },
    "power_bank": {
        "brands": ["随行", "电量Max", "便携", "能格", "航电"],
        "models": ["PB10", "PB20", "Mini", "Travel 30", "Slim 12", "Go 22"],
        "name_suffix": "充电宝",
        "descriptions": ["移动电源", "大容量", "轻薄便携", "快充支持", "日常通勤"],
        "serial_prefix": "SN-PB",
    },
    "smart_watch": {
        "brands": ["曜动", "心率星", "腕航", "智步", "脉冲"],
        "models": ["Lite", "S", "Ref", "Fit Pro", "Watch 3", "Active"],
        "name_suffix": "手表",
        "descriptions": ["健康监测", "蓝牙通话", "长续航", "运动模式", "轻量佩戴"],
        "serial_prefix": "SN-SW",
    },
    "camera": {
        "brands": ["影像", "光域", "快影", "镜界", "视野"],
        "models": ["M3", "Mini", "Snap", "R10", "Zoom X", "Vlog 5"],
        "name_suffix": "相机",
        "descriptions": ["微单套机", "高速对焦", "高清视频", "便携机身", "旅行拍摄"],
        "serial_prefix": "SN-CAM",
    },
    "router": {
        "brands": ["迅联", "天线", "云网", "速域", "远程星"],
        "models": ["AX3000", "R7", "Mesh Pro", "AX1800", "Home 6", "AX6000"],
        "name_suffix": "路由器",
        "descriptions": ["WiFi6双频", "稳定覆盖", "低延迟", "家用网络", "Mesh组网"],
        "serial_prefix": "SN-RT",
    },
    "accessory": {
        "brands": ["原装", "智连", "快接", "拓展者", "桥接"],
        "models": ["C1", "Dock 8", "Link Pro", "Hub 7", "Cable Max", "Adapter 4"],
        "name_suffix": "配件",
        "descriptions": ["数据线", "扩展坞", "转接器", "原厂附件", "便携连接"],
        "serial_prefix": "SN-ACC",
    },
}

INSPECTION_AGENCIES = [
    "深圳质检中心",
    "广州电子检验所",
    "上海质量检测院",
    "杭州电子检测站",
    "南京消费品检测院",
    "北京电子产品检测所",
    "成都电子检测中心",
    "苏州声学检测中心",
    "东莞质量评估站",
]

ENERGY_LEVELS = ["Level 1", "Level 2", "Level 3"]
ACCESSORY_STATUS_OPTIONS = ["full", "partial", "none"]
APPEARANCE_GRADES = ["S", "A", "B", "C"]
ROHS_STATUS_OPTIONS = ["compliant", "limited", "unknown"]

PASS_SCENARIOS = [
    "fully_compliant",
    "stable_runtime",
    "certified_packaging",
    "complete_report",
]
REVIEW_SCENARIOS = [
    "used_declared",
    "refurbished_declared",
    "brief_report",
    "package_reworked",
    "energy_info_partial",
    "conditional_observation",
]
FAIL_SCENARIOS = [
    "missing_ccc_and_risk",
    "missing_identifier_and_heat",
    "undisclosed_refurbish",
    "thermal_failure",
    "model_mismatch",
    "counterfeit_suspected",
    "functional_failure",
]

PASS_REPORTS = [
    "检测报告显示整机功能正常 各项安全与稳定性测试合格 可正常销售",
    "抽检结果为合格 性能 输出和绝缘测试均符合要求",
    "连续运行测试通过 结构完好 未见异常发热和风险点",
    "样机经检测符合标准 关键部件状态正常 可上市流通",
    "实验室记录显示设备在标准工况下工作稳定 未发现异常告警",
]
REVIEW_REPORTS = [
    "功能测试可用 外观存在轻微磨损 建议人工确认页面说明与成色描述",
    "翻新记录已声明 样机功能正常 建议带翻新标识销售并人工复核详情",
    "基础检测通过 但报告内容较简略 建议复核附件与证书映射关系",
    "包装封签存在重新整理痕迹 样机主要功能正常 建议人工抽检",
    "环境或能效信息不够完整 建议核对补充资料后再放行",
    "检测意见为有条件合格 需人工确认备注项是否已在商品页披露",
]
FAIL_REPORTS = [
    "检测中发现关键安全项未达标 不建议继续销售",
    "设备身份信息无法核验 且存在异常发热记录 不应上架",
    "翻新和维修痕迹明显 但未完整披露整备历史 风险较高",
    "高温或耐压测试未通过 存在安全隐患 应直接拦截",
    "报告中标注型号与申报型号不一致 存在套证或错报风险",
    "来源证明不足 外包装与铭牌信息异常 疑似仿冒或未经授权产品",
    "关键功能测试失败 且复测结果仍异常 不满足流通要求",
]

ENGLISH_APPENDICES = [
    "Result: pass under normal operating conditions.",
    "Manual review is recommended before release.",
    "Observed thermal issue during repeated charging cycle.",
    "Model code in report does not match seller declaration.",
]


def weighted_pick(rng: random.Random, values: list[str]) -> str:
    return values[rng.randrange(len(values))]


def build_id(category: str, index: int) -> str:
    return f"EA-{category[:3].upper()}-{index:05d}"


def determine_split(index_within_category: int, per_category_total: int) -> str:
    train_cutoff = int(per_category_total * 0.7)
    val_cutoff = int(per_category_total * 0.85)
    if index_within_category < train_cutoff:
        return "train"
    if index_within_category < val_cutoff:
        return "val"
    return "test"


def bool_text(value: bool | None) -> str:
    if value is None:
        return ""
    return "true" if value else "false"


def maybe(prefix: str, value: str) -> str:
    return f"{prefix}{value}" if value else ""


def build_serial(category: str, index: int) -> str:
    prefix = CATEGORY_CONFIG[category]["serial_prefix"]
    if prefix == "IMEI":
        return f"IMEI{860000000 + index}"
    return f"{prefix}-{index:06d}"


def build_base_record(category: str, index: int, rng: random.Random) -> dict[str, str]:
    config = CATEGORY_CONFIG[category]
    brand = weighted_pick(rng, config["brands"])
    model = weighted_pick(rng, config["models"])
    descriptor = weighted_pick(rng, config["descriptions"])

    record = {
        "sample_id": build_id(category, index),
        "split": "train",
        "category": category,
        "name": f"{brand}{model}{config['name_suffix']}",
        "description": f"{descriptor}{config['name_suffix']}",
        "brand": brand,
        "model": model,
        "serial_number": "",
        "batch_no": f"B{2025 + (index % 2)}-{index % 1000:03d}",
        "is_used": "false",
        "is_refurbished": "false",
        "battery_health": "",
        "accessory_status": weighted_pick(rng, ACCESSORY_STATUS_OPTIONS[:2]),
        "ccc_number": "",
        "energy_level": weighted_pick(rng, ENERGY_LEVELS[:2]),
        "rohs_status": weighted_pick(rng, ["compliant", "compliant", "limited"]),
        "inspection_agency": weighted_pick(rng, INSPECTION_AGENCIES),
        "inspection_conclusion": "pass",
        "battery_safety_passed": "",
        "charger_safety_passed": "",
        "appearance_grade": "",
        "functional_test_passed": "true",
        "repair_history_declared": "",
        "report_text": "",
        "risk_level": "low",
        "audit_label": "PASS",
        "reason_codes": "",
    }

    if category in {"mobile_phone", "tablet", "laptop", "smart_watch", "camera", "router"}:
        record["serial_number"] = build_serial(category, index)

    if category in {"mobile_phone", "tablet", "laptop", "smart_watch", "camera", "earphone", "power_bank"}:
        record["battery_health"] = str(rng.randint(88, 100))
        record["battery_safety_passed"] = "true"

    if category in {"mobile_phone", "tablet", "laptop", "smart_watch", "camera", "earphone", "charger", "router", "accessory"}:
        record["charger_safety_passed"] = "true"

    if category == "charger":
        record["ccc_number"] = f"CCC-CH-{index:05d}"
    if category == "power_bank":
        record["ccc_number"] = f"CCC-PB-{index:05d}"
    if category in {"router", "accessory"}:
        record["battery_safety_passed"] = "true"

    return record


def build_reason_codes(codes: list[str]) -> str:
    unique_codes: list[str] = []
    for code in codes:
        if code and code not in unique_codes:
            unique_codes.append(code)
    return "|".join(unique_codes)


def pass_record(category: str, index: int, rng: random.Random) -> dict[str, str]:
    record = build_base_record(category, index, rng)
    scenario = PASS_SCENARIOS[index % len(PASS_SCENARIOS)]
    record["inspection_conclusion"] = "pass"
    record["risk_level"] = "low"
    record["audit_label"] = "PASS"
    record["report_text"] = weighted_pick(rng, PASS_REPORTS)

    if scenario == "stable_runtime":
        record["report_text"] += " 连续运行24小时未发现掉线、死机或输出波动。"
    elif scenario == "certified_packaging":
        record["accessory_status"] = weighted_pick(rng, ["full", "full", "partial"])
        record["report_text"] += " 包装、铭牌与申报信息一致。"
    elif scenario == "complete_report":
        record["rohs_status"] = "compliant"
        record["energy_level"] = "Level 1"
        record["report_text"] += " 证书、批次和能效资料完整。"

    return record


def review_record(category: str, index: int, rng: random.Random) -> dict[str, str]:
    record = build_base_record(category, index, rng)
    scenario = REVIEW_SCENARIOS[index % len(REVIEW_SCENARIOS)]
    record["inspection_conclusion"] = "conditional_pass"
    record["risk_level"] = "medium"
    record["audit_label"] = "REVIEW"
    record["report_text"] = weighted_pick(rng, REVIEW_REPORTS)

    if scenario == "used_declared":
        record["is_used"] = "true"
        record["battery_health"] = str(rng.randint(76, 90)) if record["battery_health"] else ""
        record["appearance_grade"] = weighted_pick(rng, ["A", "B"])
        record["repair_history_declared"] = "true"
        record["description"] = f"二手{record['description']}"
    elif scenario == "refurbished_declared":
        record["is_refurbished"] = "true"
        record["battery_health"] = str(rng.randint(80, 92)) if record["battery_health"] else ""
        record["appearance_grade"] = weighted_pick(rng, ["A", "B"])
        record["repair_history_declared"] = "true"
        record["description"] = f"官方翻新{record['description']}"
    elif scenario == "brief_report":
        record["report_text"] = "已检测 基本可用 建议人工复核。"
    elif scenario == "package_reworked":
        record["accessory_status"] = weighted_pick(rng, ["partial", "partial", "full"])
        record["report_text"] += " 封签或包装存在重新整理迹象。"
    elif scenario == "energy_info_partial":
        record["energy_level"] = weighted_pick(rng, ["Level 2", "Level 3"])
        record["rohs_status"] = weighted_pick(rng, ["limited", "unknown"])
    elif scenario == "conditional_observation":
        record["report_text"] += " 个别备注项需人工判断是否影响销售结论。"

    return record


def fail_record(category: str, index: int, rng: random.Random) -> dict[str, str]:
    record = build_base_record(category, index, rng)
    scenario = FAIL_SCENARIOS[index % len(FAIL_SCENARIOS)]
    record["inspection_conclusion"] = "fail"
    record["risk_level"] = "high"
    record["audit_label"] = "FAIL"
    record["report_text"] = weighted_pick(rng, FAIL_REPORTS)
    reasons: list[str] = []

    if scenario == "missing_ccc_and_risk" and category in {"charger", "power_bank"}:
        record["ccc_number"] = ""
        if category == "charger":
            record["charger_safety_passed"] = "false"
        else:
            record["battery_safety_passed"] = "false"
        reasons.extend(["missing_ccc_information", "battery_safety_concern"])
    elif scenario == "missing_identifier_and_heat" and category in {"mobile_phone", "tablet"}:
        record["serial_number"] = ""
        record["battery_safety_passed"] = "false"
        record["charger_safety_passed"] = "false"
        reasons.extend(["missing_device_identifier", "battery_safety_concern"])
    elif scenario == "undisclosed_refurbish":
        record["is_refurbished"] = "true"
        record["appearance_grade"] = weighted_pick(rng, ["B", "C"])
        record["repair_history_declared"] = "false"
        reasons.append("undisclosed_refurbished_status")
    elif scenario == "thermal_failure":
        if record["battery_safety_passed"]:
            record["battery_safety_passed"] = "false"
        if record["charger_safety_passed"]:
            record["charger_safety_passed"] = "false"
        record["battery_health"] = str(rng.randint(42, 74)) if record["battery_health"] else ""
        reasons.append("battery_safety_concern")
    elif scenario == "model_mismatch":
        report_model = weighted_pick(rng, CATEGORY_CONFIG[category]["models"])
        if report_model == record["model"]:
            report_model = f"{report_model}X"
        record["report_text"] = f"报告中标注型号为{report_model}，与申报型号{record['model']}不一致，存在套证或错报风险。"
        reasons.append("report_model_mismatch")
    elif scenario == "counterfeit_suspected":
        record["report_text"] = "来源证明不足，包装与铭牌信息存在异常，疑似仿冒或未经授权产品。"
        reasons.append("suspected_counterfeit")
    elif scenario == "functional_failure":
        record["functional_test_passed"] = "false"
        record["report_text"] = "关键功能测试失败，复测仍异常，不满足流通要求。"
    else:
        if category in {"charger", "power_bank"}:
            record["ccc_number"] = ""
            reasons.append("missing_ccc_information")
        else:
            record["serial_number"] = ""
            reasons.append("missing_device_identifier")

    record["reason_codes"] = build_reason_codes(reasons)
    return record


def add_conflict_noise(record: dict[str, str], rng: random.Random) -> None:
    conflict_type = rng.randrange(5)
    if conflict_type == 0 and record["audit_label"] != "FAIL":
        record["report_text"] += " 备注：包装文字与申报信息需人工核对。"
    elif conflict_type == 1 and record["audit_label"] == "PASS":
        record["description"] = f"{record['description']}，卖家补充资料稍后上传"
    elif conflict_type == 2 and record["audit_label"] == "REVIEW":
        record["report_text"] += " 系统初判可流通，但建议人工再核验。"
    elif conflict_type == 3 and record["audit_label"] == "FAIL":
        record["report_text"] += " 初次送检摘要写为合格，复核后已修正为不合格。"
    elif conflict_type == 4 and record["audit_label"] == "FAIL":
        record["description"] = f"卖家宣称全新未拆封，{record['description']}"


def add_sparse_text_noise(record: dict[str, str], rng: random.Random) -> None:
    style = rng.randrange(4)
    if style == 0:
        record["report_text"] = "见附件。"
    elif style == 1:
        record["report_text"] = "检测完成，建议复核。"
    elif style == 2:
        record["description"] = record["description"][: max(4, len(record["description"]) // 2)]
    else:
        record["report_text"] = f"{record['inspection_conclusion']} / {record['risk_level']} / {record['category']}"


def add_ocr_noise(record: dict[str, str], rng: random.Random) -> None:
    text = record["report_text"]
    if not text:
        return

    replacements = {
        "检测": "检測",
        "通过": "通過",
        "不合格": "不 合 格",
        "型号": "型號",
        "风险": "風险",
        "包装": "包 装",
        "人工": "人 工",
        "建议": "建 议",
    }
    for source, target in replacements.items():
        if source in text and rng.random() < 0.45:
            text = text.replace(source, target, 1)

    if rng.random() < 0.5:
        text = text.replace("，", ", ").replace("。", " ")
    if rng.random() < 0.4:
        text += f" {weighted_pick(rng, ENGLISH_APPENDICES)}"

    record["report_text"] = text.strip()


def add_field_noise(record: dict[str, str], rng: random.Random) -> None:
    if record["audit_label"] == "PASS" and rng.random() < 0.2:
        record["accessory_status"] = weighted_pick(rng, ["partial", "full"])
    if record["audit_label"] == "REVIEW" and rng.random() < 0.35:
        if record["category"] in {"mobile_phone", "tablet"} and rng.random() < 0.3:
            record["serial_number"] = record["serial_number"][:8] if record["serial_number"] else ""
    if rng.random() < 0.15:
        record["inspection_agency"] = weighted_pick(rng, ["第三方送检", "平台复核", "外部资料摘录"])
    if rng.random() < 0.1:
        record["batch_no"] = ""


def apply_realism_noise(record: dict[str, str], rng: random.Random) -> None:
    if rng.random() < 0.28:
        add_conflict_noise(record, rng)
    if rng.random() < 0.12:
        add_sparse_text_noise(record, rng)
    if rng.random() < 0.18:
        add_ocr_noise(record, rng)
    if rng.random() < 0.22:
        add_field_noise(record, rng)


def records_for_category(category: str, count: int, start_index: int, rng: random.Random) -> list[dict[str, str]]:
    pass_count = int(count * 0.4)
    review_count = int(count * 0.35)
    fail_count = count - pass_count - review_count

    builders = [pass_record] * pass_count + [review_record] * review_count + [fail_record] * fail_count
    rng.shuffle(builders)

    rows: list[dict[str, str]] = []
    for local_index, builder in enumerate(builders):
        absolute_index = start_index + local_index
        row = builder(category, absolute_index, rng)
        row["sample_id"] = build_id(category, absolute_index)
        row["split"] = determine_split(local_index, count)
        apply_realism_noise(row, rng)
        rows.append(row)
    return rows


def generate_rows(total_rows: int, seed: int) -> list[dict[str, str]]:
    if total_rows < len(CATEGORIES):
        raise ValueError("total_rows must be at least the number of categories")

    rng = random.Random(seed)
    per_category_base = total_rows // len(CATEGORIES)
    remainder = total_rows % len(CATEGORIES)

    rows: list[dict[str, str]] = []
    absolute_index = 1
    for category_index, category in enumerate(CATEGORIES):
        count = per_category_base + (1 if category_index < remainder else 0)
        rows.extend(records_for_category(category, count, absolute_index, rng))
        absolute_index += count
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
    parser = argparse.ArgumentParser(description="Generate a synthetic electronic audit dataset.")
    parser.add_argument("--rows", type=int, default=DEFAULT_TOTAL, help="Total rows to generate")
    parser.add_argument("--seed", type=int, default=SEED, help="Random seed")
    parser.add_argument("--output", default=str(OUTPUT_PATH), help="Output CSV path")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rows = generate_rows(args.rows, args.seed)
    write_csv(rows, Path(args.output))
    print(f"Generated {len(rows)} rows -> {args.output}")


if __name__ == "__main__":
    main()
