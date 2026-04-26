from __future__ import annotations

import argparse
import csv
import html
import re
import time
from pathlib import Path
from typing import Any
from urllib.parse import urljoin
from urllib.request import Request, urlopen


LIST_BASE_URL = "https://www.samrdprc.org.cn/xfpzh/xfpzhgg/"
OUTPUT_PATH = Path(__file__).resolve().parent / "data" / "china_recall_fail_samples.csv"

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
    ("power_bank", ["充电宝", "移动电源", "锂电池包", "电池包"]),
    ("charger", ["充电器", "电源适配器", "适配器", "电源供应器", "开关电源", "插头", "插座"]),
    ("mobile_phone", ["手机", "移动电话", "电话手表"]),
    ("tablet", ["平板电脑", "平板", "学习机", "写字板"]),
    ("laptop", ["笔记本", "电脑", "计算机", "显示器", "主机"]),
    ("earphone", ["耳机", "耳麦", "蓝牙耳"]),
    ("smart_watch", ["智能手表", "手表"]),
    ("camera", ["相机", "摄像头", "摄像机", "监控"]),
    ("router", ["路由器", "网关", "无线网络"]),
    (
        "accessory",
        [
            "电灭蚊拍",
            "排气扇",
            "换气扇",
            "电烤炉",
            "美容仪",
            "led",
            "灯",
            "暖桌垫",
            "电热",
            "小家电",
            "电器",
            "电动",
        ],
    ),
]

ELECTRONIC_SIGNAL_KEYWORDS = [
    "gb 4706",
    "gb4943",
    "ccc",
    "usb",
    "led",
    "充电",
    "电池",
    "锂电",
    "电源",
    "适配器",
    "电气",
    "电器",
    "电动",
    "带电",
    "短路",
    "触电",
    "起火",
    "过热",
    "发热",
    "烧伤",
    "爆炸",
    "漏电",
]

REASON_KEYWORDS = {
    "missing_ccc_information": ["ccc", "强制性认证", "认证", "3c"],
    "battery_safety_concern": [
        "电池",
        "锂电",
        "充电",
        "过热",
        "发热",
        "起火",
        "火灾",
        "爆炸",
        "触电",
        "电击",
        "漏电",
        "短路",
        "烧伤",
        "带电部件",
    ],
    "report_model_mismatch": ["型号不一致", "规格不一致", "标识不一致"],
    "suspected_counterfeit": ["假冒", "仿冒", "冒用", "未经授权"],
}


def compact_text(value: Any) -> str:
    text = html.unescape(str(value or ""))
    text = re.sub(r"\s+", " ", text).strip()
    text = text.replace("\u3000", " ")
    return re.sub(r"\s+", " ", text).strip()


def strip_tags(value: str) -> str:
    value = re.sub(r"<script.*?</script>", " ", value, flags=re.IGNORECASE | re.DOTALL)
    value = re.sub(r"<style.*?</style>", " ", value, flags=re.IGNORECASE | re.DOTALL)
    value = re.sub(r"<[^>]+>", " ", value)
    return compact_text(value)


def fetch_text(url: str, timeout: int) -> str:
    request = Request(url, headers={"User-Agent": "electronic-regulation-ai-dataset/1.0"})
    with urlopen(request, timeout=timeout) as response:
        data = response.read()
    return data.decode("utf-8", errors="replace")


def list_url(page_index: int) -> str:
    if page_index == 0:
        return urljoin(LIST_BASE_URL, "index.html")
    return urljoin(LIST_BASE_URL, f"index_{page_index}.html")


def extract_article_links(list_html: str, base_url: str) -> list[tuple[str, str]]:
    links: list[tuple[str, str]] = []
    for match in re.finditer(
        r"<a[^>]+href=[\"']([^\"']*?/xfpzh/xfpzhgg/20[^\"']+\.html|\./20[^\"']+\.html|20[^\"']+\.html|\./t20[^\"']+\.html)[\"'][^>]*>(.*?)</a>",
        list_html,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        href = match.group(1)
        title = strip_tags(match.group(2))
        if not title or "召回" not in title:
            continue
        links.append((urljoin(base_url, href), title))
    deduped: dict[str, str] = {}
    for url, title in links:
        deduped.setdefault(url, title)
    return list(deduped.items())


def extract_title(article_html: str, fallback: str) -> str:
    match = re.search(r"<div\s+class=[\"']show_tit[\"'][^>]*>\s*<h1>(.*?)</h1>", article_html, re.S)
    return strip_tags(match.group(1)) if match else fallback


def extract_publish_date(article_html: str) -> str:
    match = re.search(r"发布时间[：:]\s*([0-9]{4}-[0-9]{2}-[0-9]{2})", article_html)
    return match.group(1) if match else ""


def extract_table_fields(article_html: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for row_match in re.finditer(r"<tr[^>]*>(.*?)</tr>", article_html, flags=re.I | re.S):
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row_match.group(1), flags=re.I | re.S)
        if len(cells) < 2:
            continue
        key = strip_tags(cells[0]).replace(" ", "")
        value = strip_tags(" ".join(cells[1:]))
        if key and value and value not in {"/", "无"}:
            fields[key] = value
    return fields


def extract_body_text(article_html: str) -> str:
    match = re.search(r"<div\s+class=[\"']show_txt[\"'][^>]*>(.*?)<div\s+class=[\"']prenex[\"']", article_html, re.S)
    body_html = match.group(1) if match else article_html
    return strip_tags(body_html)


def contains_any(text: str, keywords: list[str]) -> bool:
    lowered = text.lower()
    return any(keyword.lower() in lowered for keyword in keywords)


def is_relevant_electronic(title: str, fields: dict[str, str], body_text: str) -> bool:
    source = " ".join([title, " ".join(fields.values()), body_text])
    return contains_any(source, ELECTRONIC_SIGNAL_KEYWORDS)


def infer_category(source_text: str) -> str:
    lowered = source_text.lower()
    for category, keywords in CATEGORY_KEYWORDS:
        if any(keyword.lower() in lowered for keyword in keywords):
            return category
    return "accessory"


def pick_field(fields: dict[str, str], names: list[str]) -> str:
    for field_name in names:
        for key, value in fields.items():
            if field_name in key:
                return value
    return ""


def extract_recall_id(url: str, fallback_index: int) -> str:
    match = re.search(r"t(\d+)_([0-9]+)\.html", url)
    if match:
        return f"{match.group(1)}-{match.group(2)}"
    return f"{fallback_index:05d}"


def infer_reason_codes(category: str, source_text: str) -> str:
    reasons: list[str] = []
    lowered = source_text.lower()
    if category in {"charger", "power_bank"}:
        reasons.append("missing_ccc_information")
    for code, keywords in REASON_KEYWORDS.items():
        if any(keyword.lower() in lowered for keyword in keywords):
            reasons.append(code)
    return "|".join(dict.fromkeys(reasons))


def split_for_index(index: int) -> str:
    bucket = index % 10
    if bucket < 7:
        return "train"
    if bucket < 9:
        return "val"
    return "test"


def normalize_article(url: str, fallback_title: str, article_html: str, index: int) -> dict[str, str] | None:
    title = extract_title(article_html, fallback_title)
    publish_date = extract_publish_date(article_html)
    fields = extract_table_fields(article_html)
    body_text = extract_body_text(article_html)
    if not is_relevant_electronic(title, fields, body_text):
        return None

    product_name = pick_field(fields, ["产品名称"]) or title
    brand = pick_field(fields, ["品牌"])
    model = pick_field(fields, ["型号", "规格"])
    batch_no = pick_field(fields, ["生产批号", "批次"])
    defect = pick_field(fields, ["存在的缺陷"])
    consequence = pick_field(fields, ["可能导致的后果"])
    remedy = pick_field(fields, ["具体召回措施", "应急处置"])
    producer = pick_field(fields, ["生产者名称", "召回负责机构"])
    count = pick_field(fields, ["涉及数量"])
    source_text = " ".join([title, product_name, brand, model, defect, consequence, remedy, body_text])
    category_source = " ".join([title, product_name, brand, model])
    category = infer_category(category_source)
    reason_codes = infer_reason_codes(category, source_text)

    report_parts = [
        f"中国缺陷产品召回公告 {publish_date}。" if publish_date else "中国缺陷产品召回公告。",
        f"标题：{title}",
        f"生产者：{producer}" if producer else "",
        f"产品：{product_name}" if product_name else "",
        f"品牌：{brand}" if brand else "",
        f"型号规格：{model}" if model else "",
        f"涉及数量：{count}" if count else "",
        f"存在的缺陷：{defect}" if defect else "",
        f"可能导致的后果：{consequence}" if consequence else "",
        f"召回措施：{remedy}" if remedy else "",
        f"来源：{url}",
    ]
    report_text = " ".join(part for part in report_parts if part)
    has_safety_risk = contains_any(source_text, REASON_KEYWORDS["battery_safety_concern"])
    recall_id = extract_recall_id(url, index)

    return {
        "sample_id": f"CN-RECALL-{recall_id}",
        "split": split_for_index(index),
        "category": category,
        "name": product_name[:120],
        "description": title[:240],
        "brand": brand[:100],
        "model": model[:100],
        "serial_number": "",
        "batch_no": batch_no[:100],
        "is_used": "false",
        "is_refurbished": "false",
        "battery_health": "50" if has_safety_risk and category in {"power_bank", "mobile_phone", "tablet", "laptop"} else "",
        "accessory_status": "unknown",
        "ccc_number": "",
        "energy_level": "unknown",
        "rohs_status": "unknown",
        "inspection_agency": "国家市场监督管理总局缺陷产品召回技术中心",
        "inspection_conclusion": "fail",
        "battery_safety_passed": "false" if has_safety_risk else "",
        "charger_safety_passed": "false" if category in {"charger", "power_bank", "accessory"} or has_safety_risk else "",
        "appearance_grade": "",
        "functional_test_passed": "false",
        "repair_history_declared": "",
        "report_text": report_text,
        "risk_level": "high",
        "audit_label": "FAIL",
        "reason_codes": reason_codes,
    }


def collect_article_links(max_pages: int, timeout: int, delay: float) -> list[tuple[str, str]]:
    all_links: list[tuple[str, str]] = []
    seen: set[str] = set()
    for page_index in range(max_pages):
        url = list_url(page_index)
        try:
            page_html = fetch_text(url, timeout)
        except Exception as error:
            print(f"Skip list page {url}: {error}")
            continue
        for article_url, title in extract_article_links(page_html, url):
            if article_url not in seen:
                all_links.append((article_url, title))
                seen.add(article_url)
        if delay > 0:
            time.sleep(delay)
    return all_links


def collect_rows(max_pages: int, max_rows: int, timeout: int, delay: float) -> list[dict[str, str]]:
    links = collect_article_links(max_pages, timeout, delay)
    rows: list[dict[str, str]] = []
    for article_url, title in links:
        try:
            article_html = fetch_text(article_url, timeout)
        except Exception as error:
            print(f"Skip article {article_url}: {error}")
            continue
        row = normalize_article(article_url, title, article_html, len(rows) + 1)
        if row:
            rows.append(row)
        if len(rows) >= max_rows:
            break
        if delay > 0:
            time.sleep(delay)
    return rows


def write_csv(rows: list[dict[str, str]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import Chinese product recall notices as FAIL samples.")
    parser.add_argument("--output", default=str(OUTPUT_PATH), help="Output CSV path")
    parser.add_argument("--max-pages", type=int, default=40, help="Number of recall list pages to scan")
    parser.add_argument("--max-rows", type=int, default=240, help="Maximum rows to write")
    parser.add_argument("--timeout", type=int, default=30, help="HTTP timeout in seconds")
    parser.add_argument("--delay", type=float, default=0.05, help="Delay between HTTP requests")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rows = collect_rows(args.max_pages, args.max_rows, args.timeout, args.delay)
    write_csv(rows, Path(args.output))
    print(f"Imported {len(rows)} Chinese recall rows -> {args.output}")


if __name__ == "__main__":
    main()
