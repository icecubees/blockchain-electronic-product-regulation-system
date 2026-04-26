from __future__ import annotations

import argparse
import csv
import random
from pathlib import Path


OUTPUT_PATH = Path(__file__).resolve().parent / "data" / "electronic_audit_dataset.csv"
DEFAULT_REAL_FAIL_INPUT = Path(__file__).resolve().parent / "data" / "cpsc_recall_fail_samples.csv"
DEFAULT_TOTAL = 3200
DEFAULT_REAL_NAME_RATE = 0.70
DEFAULT_MAX_REAL_FAIL_ROWS = 240
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

REAL_PRODUCT_PROFILES = {
    "mobile_phone": [
        {
            "brand": "Apple",
            "model": "iPhone 13",
            "name": "Apple iPhone 13 手机",
            "description": "A15 芯片 5G 智能手机",
        },
        {
            "brand": "Samsung",
            "model": "Galaxy S23",
            "name": "Samsung Galaxy S23 智能手机",
            "description": "骁龙平台 影像旗舰 5G 手机",
        },
        {
            "brand": "Xiaomi",
            "model": "Redmi Note 12 5G",
            "name": "Xiaomi Redmi Note 12 5G 手机",
            "description": "OLED 屏幕 长续航 5G 手机",
        },
        {
            "brand": "Huawei",
            "model": "Mate 50",
            "name": "Huawei Mate 50 智能手机",
            "description": "影像旗舰 北斗消息 智能手机",
        },
        {
            "brand": "OPPO",
            "model": "Reno10",
            "name": "OPPO Reno10 手机",
            "description": "轻薄人像拍摄 5G 智能手机",
        },
        {
            "brand": "vivo",
            "model": "X90",
            "name": "vivo X90 手机",
            "description": "影像芯片 高刷屏 智能手机",
        },
    ],
    "laptop": [
        {
            "brand": "Apple",
            "model": "MacBook Air 13 M2",
            "name": "Apple MacBook Air 13 M2 笔记本",
            "description": "轻薄办公 13 英寸笔记本电脑",
        },
        {
            "brand": "Lenovo",
            "model": "ThinkPad X1 Carbon Gen 10",
            "name": "Lenovo ThinkPad X1 Carbon Gen 10 笔记本",
            "description": "商务轻薄 碳纤维机身 笔记本电脑",
        },
        {
            "brand": "Dell",
            "model": "XPS 13 9315",
            "name": "Dell XPS 13 9315 笔记本",
            "description": "轻薄办公 高分辨率屏幕 笔记本电脑",
        },
        {
            "brand": "HP",
            "model": "Spectre x360 14",
            "name": "HP Spectre x360 14 笔记本",
            "description": "翻转触控 商务办公 笔记本电脑",
        },
        {
            "brand": "ASUS",
            "model": "ROG Zephyrus G14",
            "name": "ASUS ROG Zephyrus G14 笔记本",
            "description": "游戏性能 独立显卡 笔记本电脑",
        },
    ],
    "tablet": [
        {
            "brand": "Apple",
            "model": "iPad 10th Gen",
            "name": "Apple iPad 第十代 平板电脑",
            "description": "10.9 英寸学习办公平板电脑",
        },
        {
            "brand": "Samsung",
            "model": "Galaxy Tab S9",
            "name": "Samsung Galaxy Tab S9 平板电脑",
            "description": "AMOLED 屏幕 防水平板电脑",
        },
        {
            "brand": "Huawei",
            "model": "MatePad 11.5",
            "name": "Huawei MatePad 11.5 平板电脑",
            "description": "学习办公 护眼屏 平板电脑",
        },
        {
            "brand": "Lenovo",
            "model": "Xiaoxin Pad Pro 12.7",
            "name": "Lenovo 小新 Pad Pro 12.7 平板电脑",
            "description": "大屏娱乐 学习办公平板电脑",
        },
        {
            "brand": "Xiaomi",
            "model": "Pad 6",
            "name": "Xiaomi Pad 6 平板电脑",
            "description": "高刷屏 骁龙平台 平板电脑",
        },
    ],
    "earphone": [
        {
            "brand": "Apple",
            "model": "AirPods Pro 2",
            "name": "Apple AirPods Pro 2 无线耳机",
            "description": "主动降噪 真无线蓝牙耳机",
        },
        {
            "brand": "Sony",
            "model": "WF-1000XM5",
            "name": "Sony WF-1000XM5 真无线耳机",
            "description": "主动降噪 高解析音频蓝牙耳机",
        },
        {
            "brand": "Bose",
            "model": "QuietComfort Earbuds II",
            "name": "Bose QuietComfort Earbuds II 耳机",
            "description": "降噪通话 真无线蓝牙耳机",
        },
        {
            "brand": "Huawei",
            "model": "FreeBuds Pro 3",
            "name": "Huawei FreeBuds Pro 3 无线耳机",
            "description": "智慧降噪 双设备连接蓝牙耳机",
        },
        {
            "brand": "Xiaomi",
            "model": "Redmi Buds 5 Pro",
            "name": "Xiaomi Redmi Buds 5 Pro 耳机",
            "description": "主动降噪 长续航蓝牙耳机",
        },
    ],
    "charger": [
        {
            "brand": "Apple",
            "model": "20W USB-C Power Adapter",
            "name": "Apple 20W USB-C 电源适配器",
            "description": "USB-C 快充电源适配器",
        },
        {
            "brand": "Anker",
            "model": "511 Charger 30W",
            "name": "Anker 511 Charger 30W 充电器",
            "description": "GaN 氮化镓 USB-C 快充充电器",
        },
        {
            "brand": "UGREEN",
            "model": "Nexode 65W",
            "name": "UGREEN Nexode 65W 氮化镓充电器",
            "description": "多口 USB-C 氮化镓快充充电器",
        },
        {
            "brand": "Baseus",
            "model": "GaN5 Pro 65W",
            "name": "Baseus GaN5 Pro 65W 充电器",
            "description": "三口氮化镓快充充电器",
        },
        {
            "brand": "Samsung",
            "model": "EP-TA800",
            "name": "Samsung EP-TA800 25W 充电器",
            "description": "USB-C 快速充电旅行适配器",
        },
    ],
    "power_bank": [
        {
            "brand": "Anker",
            "model": "PowerCore 10000",
            "name": "Anker PowerCore 10000 移动电源",
            "description": "10000mAh 便携移动电源",
        },
        {
            "brand": "Xiaomi",
            "model": "Mi Power Bank 3 20000mAh",
            "name": "Xiaomi 移动电源 3 20000mAh",
            "description": "双向快充 大容量移动电源",
        },
        {
            "brand": "Baseus",
            "model": "Adaman 20000mAh 65W",
            "name": "Baseus Adaman 20000mAh 65W 移动电源",
            "description": "金属外壳 大功率快充移动电源",
        },
        {
            "brand": "UGREEN",
            "model": "145W Power Bank 25000mAh",
            "name": "UGREEN 145W 25000mAh 移动电源",
            "description": "多口大功率移动电源",
        },
    ],
    "smart_watch": [
        {
            "brand": "Apple",
            "model": "Watch Series 8",
            "name": "Apple Watch Series 8 智能手表",
            "description": "健康监测 GPS 智能手表",
        },
        {
            "brand": "Huawei",
            "model": "Watch GT 4",
            "name": "Huawei Watch GT 4 智能手表",
            "description": "运动健康监测 长续航智能手表",
        },
        {
            "brand": "Samsung",
            "model": "Galaxy Watch6",
            "name": "Samsung Galaxy Watch6 智能手表",
            "description": "健康追踪 蓝牙智能手表",
        },
        {
            "brand": "Garmin",
            "model": "Forerunner 265",
            "name": "Garmin Forerunner 265 运动手表",
            "description": "GPS 跑步训练运动手表",
        },
    ],
    "camera": [
        {
            "brand": "Canon",
            "model": "EOS R50",
            "name": "Canon EOS R50 微单相机",
            "description": "APS-C 画幅微单套机",
        },
        {
            "brand": "Sony",
            "model": "ZV-E10",
            "name": "Sony ZV-E10 微单相机",
            "description": "Vlog 视频拍摄微单相机",
        },
        {
            "brand": "Nikon",
            "model": "Z fc",
            "name": "Nikon Z fc 微单相机",
            "description": "复古外观 无反微单相机",
        },
        {
            "brand": "Fujifilm",
            "model": "X-S10",
            "name": "Fujifilm X-S10 微单相机",
            "description": "五轴防抖 便携微单相机",
        },
    ],
    "router": [
        {
            "brand": "TP-Link",
            "model": "Archer AX55",
            "name": "TP-Link Archer AX55 Wi-Fi 6 路由器",
            "description": "AX3000 双频 Wi-Fi 6 路由器",
        },
        {
            "brand": "ASUS",
            "model": "RT-AX86U",
            "name": "ASUS RT-AX86U Wi-Fi 6 路由器",
            "description": "电竞网络 双频 Wi-Fi 6 路由器",
        },
        {
            "brand": "Xiaomi",
            "model": "AX3000",
            "name": "Xiaomi AX3000 路由器",
            "description": "Mesh 组网 Wi-Fi 6 路由器",
        },
        {
            "brand": "Huawei",
            "model": "AX3 Pro",
            "name": "Huawei AX3 Pro 路由器",
            "description": "双频 Wi-Fi 6 家用路由器",
        },
    ],
    "accessory": [
        {
            "brand": "Apple",
            "model": "USB-C to Lightning Cable",
            "name": "Apple USB-C 转 Lightning 连接线",
            "description": "原装数据线 充电与数据传输配件",
        },
        {
            "brand": "UGREEN",
            "model": "USB-C Hub 6-in-1",
            "name": "UGREEN USB-C 六合一扩展坞",
            "description": "HDMI USB 读卡器多功能扩展坞",
        },
        {
            "brand": "Logitech",
            "model": "MX Master 3S",
            "name": "Logitech MX Master 3S 无线鼠标",
            "description": "蓝牙办公无线鼠标",
        },
        {
            "brand": "Samsung",
            "model": "T7 Shield 1TB",
            "name": "Samsung T7 Shield 1TB 移动固态硬盘",
            "description": "便携 USB-C 移动固态硬盘",
        },
    ],
}

ADDITIONAL_REAL_PRODUCT_PROFILES = {
    "mobile_phone": [
        {
            "brand": "Apple",
            "model": "iPhone 14",
            "name": "Apple iPhone 14 手机",
            "description": "A15 芯片 5G 智能手机",
        },
        {
            "brand": "Apple",
            "model": "iPhone 15",
            "name": "Apple iPhone 15 手机",
            "description": "灵动岛 USB-C 接口 5G 智能手机",
        },
        {
            "brand": "Samsung",
            "model": "Galaxy A54 5G",
            "name": "Samsung Galaxy A54 5G 智能手机",
            "description": "AMOLED 屏幕 防水 5G 手机",
        },
        {
            "brand": "Google",
            "model": "Pixel 7",
            "name": "Google Pixel 7 智能手机",
            "description": "Tensor 芯片 影像增强 5G 手机",
        },
        {
            "brand": "OnePlus",
            "model": "OnePlus 11",
            "name": "OnePlus 11 手机",
            "description": "骁龙平台 哈苏影像 5G 手机",
        },
        {
            "brand": "HONOR",
            "model": "Magic5 Pro",
            "name": "HONOR Magic5 Pro 智能手机",
            "description": "旗舰影像 高刷屏 5G 手机",
        },
        {
            "brand": "Motorola",
            "model": "Edge 40 Pro",
            "name": "Motorola Edge 40 Pro 手机",
            "description": "高刷新率屏幕 快充 5G 手机",
        },
        {
            "brand": "Nothing",
            "model": "Phone 2",
            "name": "Nothing Phone 2 智能手机",
            "description": "透明背板 Glyph 灯效 5G 手机",
        },
    ],
    "laptop": [
        {
            "brand": "Apple",
            "model": "MacBook Pro 14 M2 Pro",
            "name": "Apple MacBook Pro 14 M2 Pro 笔记本",
            "description": "Liquid Retina XDR 屏幕 专业笔记本电脑",
        },
        {
            "brand": "Lenovo",
            "model": "Yoga Pro 14s",
            "name": "Lenovo Yoga Pro 14s 笔记本",
            "description": "高分辨率屏幕 轻薄办公笔记本电脑",
        },
        {
            "brand": "Lenovo",
            "model": "Legion 5 Pro 16",
            "name": "Lenovo Legion 5 Pro 16 游戏笔记本",
            "description": "高刷新率屏幕 独立显卡游戏笔记本",
        },
        {
            "brand": "Dell",
            "model": "Inspiron 14 5430",
            "name": "Dell Inspiron 14 5430 笔记本",
            "description": "14 英寸日常办公笔记本电脑",
        },
        {
            "brand": "HP",
            "model": "Pavilion Plus 14",
            "name": "HP Pavilion Plus 14 笔记本",
            "description": "OLED 屏幕 轻薄创作笔记本电脑",
        },
        {
            "brand": "Acer",
            "model": "Swift Go 14",
            "name": "Acer Swift Go 14 笔记本",
            "description": "轻薄便携 OLED 屏幕笔记本电脑",
        },
        {
            "brand": "Microsoft",
            "model": "Surface Laptop 5",
            "name": "Microsoft Surface Laptop 5 笔记本",
            "description": "触控屏 商务办公笔记本电脑",
        },
        {
            "brand": "Huawei",
            "model": "MateBook 14",
            "name": "Huawei MateBook 14 笔记本",
            "description": "2K 触控屏 轻薄办公笔记本电脑",
        },
    ],
    "tablet": [
        {
            "brand": "Apple",
            "model": "iPad Air 5",
            "name": "Apple iPad Air 第五代 平板电脑",
            "description": "M1 芯片 10.9 英寸平板电脑",
        },
        {
            "brand": "Apple",
            "model": "iPad Pro 11 M2",
            "name": "Apple iPad Pro 11 M2 平板电脑",
            "description": "ProMotion 屏幕 专业平板电脑",
        },
        {
            "brand": "Samsung",
            "model": "Galaxy Tab A8",
            "name": "Samsung Galaxy Tab A8 平板电脑",
            "description": "10.5 英寸娱乐学习平板电脑",
        },
        {
            "brand": "Microsoft",
            "model": "Surface Pro 9",
            "name": "Microsoft Surface Pro 9 二合一平板",
            "description": "触控键盘 二合一平板电脑",
        },
        {
            "brand": "Amazon",
            "model": "Fire HD 10",
            "name": "Amazon Fire HD 10 平板电脑",
            "description": "10.1 英寸娱乐平板电脑",
        },
        {
            "brand": "Xiaomi",
            "model": "Redmi Pad SE",
            "name": "Xiaomi Redmi Pad SE 平板电脑",
            "description": "11 英寸护眼屏 娱乐平板电脑",
        },
        {
            "brand": "Lenovo",
            "model": "Tab P12",
            "name": "Lenovo Tab P12 平板电脑",
            "description": "12.7 英寸学习娱乐平板电脑",
        },
    ],
    "earphone": [
        {
            "brand": "Sony",
            "model": "WH-1000XM5",
            "name": "Sony WH-1000XM5 头戴式耳机",
            "description": "主动降噪 蓝牙头戴式耳机",
        },
        {
            "brand": "Beats",
            "model": "Studio Buds",
            "name": "Beats Studio Buds 真无线耳机",
            "description": "主动降噪 真无线蓝牙耳机",
        },
        {
            "brand": "Jabra",
            "model": "Elite 7 Pro",
            "name": "Jabra Elite 7 Pro 真无线耳机",
            "description": "通话降噪 真无线蓝牙耳机",
        },
        {
            "brand": "Samsung",
            "model": "Galaxy Buds2 Pro",
            "name": "Samsung Galaxy Buds2 Pro 无线耳机",
            "description": "主动降噪 高解析音频蓝牙耳机",
        },
        {
            "brand": "Nothing",
            "model": "Ear 2",
            "name": "Nothing Ear 2 真无线耳机",
            "description": "透明外观 主动降噪蓝牙耳机",
        },
        {
            "brand": "JBL",
            "model": "Tune 230NC TWS",
            "name": "JBL Tune 230NC TWS 耳机",
            "description": "主动降噪 真无线蓝牙耳机",
        },
        {
            "brand": "Anker",
            "model": "Soundcore Liberty 4",
            "name": "Anker Soundcore Liberty 4 无线耳机",
            "description": "空间音频 心率监测真无线耳机",
        },
        {
            "brand": "Shokz",
            "model": "OpenRun",
            "name": "Shokz OpenRun 骨传导耳机",
            "description": "运动防水 骨传导蓝牙耳机",
        },
    ],
    "charger": [
        {
            "brand": "Anker",
            "model": "737 Charger 120W",
            "name": "Anker 737 Charger 120W 充电器",
            "description": "GaNPrime 三口 USB-C 快充充电器",
        },
        {
            "brand": "Belkin",
            "model": "BoostCharge Pro 65W",
            "name": "Belkin BoostCharge Pro 65W 充电器",
            "description": "双 USB-C 氮化镓快充充电器",
        },
        {
            "brand": "Apple",
            "model": "MagSafe Charger",
            "name": "Apple MagSafe 磁吸充电器",
            "description": "无线磁吸充电器",
        },
        {
            "brand": "Xiaomi",
            "model": "67W GaN Charger",
            "name": "Xiaomi 67W 氮化镓充电器",
            "description": "USB-C 快充电源适配器",
        },
        {
            "brand": "Huawei",
            "model": "SuperCharge 66W",
            "name": "Huawei SuperCharge 66W 充电器",
            "description": "超级快充电源适配器",
        },
        {
            "brand": "Google",
            "model": "30W USB-C Charger",
            "name": "Google 30W USB-C 充电器",
            "description": "USB-C 快充电源适配器",
        },
        {
            "brand": "Dell",
            "model": "65W USB-C AC Adapter",
            "name": "Dell 65W USB-C 电源适配器",
            "description": "笔记本电脑 USB-C 电源适配器",
        },
        {
            "brand": "Lenovo",
            "model": "65W USB-C AC Adapter",
            "name": "Lenovo 65W USB-C 电源适配器",
            "description": "ThinkPad USB-C 旅行电源适配器",
        },
    ],
    "power_bank": [
        {
            "brand": "Anker",
            "model": "737 Power Bank",
            "name": "Anker 737 Power Bank 移动电源",
            "description": "PowerCore 24000mAh 大功率移动电源",
        },
        {
            "brand": "Belkin",
            "model": "BoostCharge Power Bank 10K",
            "name": "Belkin BoostCharge 10000mAh 移动电源",
            "description": "USB-C PD 便携移动电源",
        },
        {
            "brand": "Mophie",
            "model": "Powerstation",
            "name": "Mophie Powerstation 移动电源",
            "description": "USB-C 便携移动电源",
        },
        {
            "brand": "Zendure",
            "model": "SuperTank Pro",
            "name": "Zendure SuperTank Pro 移动电源",
            "description": "100W PD 大容量移动电源",
        },
        {
            "brand": "Xiaomi",
            "model": "10000mAh Power Bank",
            "name": "Xiaomi 10000mAh 移动电源",
            "description": "便携双向快充移动电源",
        },
        {
            "brand": "ROMOSS",
            "model": "Sense 8P+",
            "name": "ROMOSS Sense 8P+ 移动电源",
            "description": "30000mAh 多口移动电源",
        },
        {
            "brand": "Baseus",
            "model": "Blade 100W Power Bank",
            "name": "Baseus Blade 100W 移动电源",
            "description": "轻薄大功率笔记本移动电源",
        },
        {
            "brand": "UGREEN",
            "model": "100W Power Bank 20000mAh",
            "name": "UGREEN 100W 20000mAh 移动电源",
            "description": "USB-C 大功率快充移动电源",
        },
    ],
    "smart_watch": [
        {
            "brand": "Apple",
            "model": "Watch Ultra 2",
            "name": "Apple Watch Ultra 2 智能手表",
            "description": "GPS 蜂窝网络户外智能手表",
        },
        {
            "brand": "Apple",
            "model": "Watch SE 2",
            "name": "Apple Watch SE 第二代 智能手表",
            "description": "健康追踪 GPS 智能手表",
        },
        {
            "brand": "Samsung",
            "model": "Galaxy Watch5 Pro",
            "name": "Samsung Galaxy Watch5 Pro 智能手表",
            "description": "蓝牙 GPS 健康监测智能手表",
        },
        {
            "brand": "Fitbit",
            "model": "Versa 4",
            "name": "Fitbit Versa 4 智能手表",
            "description": "运动健康追踪智能手表",
        },
        {
            "brand": "Garmin",
            "model": "Fenix 7",
            "name": "Garmin Fenix 7 运动手表",
            "description": "多频 GPS 户外运动手表",
        },
        {
            "brand": "Xiaomi",
            "model": "Watch S1",
            "name": "Xiaomi Watch S1 智能手表",
            "description": "蓝牙通话 健康监测智能手表",
        },
        {
            "brand": "Amazfit",
            "model": "GTR 4",
            "name": "Amazfit GTR 4 智能手表",
            "description": "运动健康管理智能手表",
        },
        {
            "brand": "Huawei",
            "model": "Watch Fit 2",
            "name": "Huawei Watch Fit 2 智能手表",
            "description": "轻量健康监测智能手表",
        },
    ],
    "camera": [
        {
            "brand": "Sony",
            "model": "Alpha 7 IV",
            "name": "Sony Alpha 7 IV 全画幅微单相机",
            "description": "全画幅混合型微单相机",
        },
        {
            "brand": "Canon",
            "model": "EOS R6 Mark II",
            "name": "Canon EOS R6 Mark II 微单相机",
            "description": "全画幅高速连拍微单相机",
        },
        {
            "brand": "Nikon",
            "model": "Z 30",
            "name": "Nikon Z 30 微单相机",
            "description": "Vlog 视频拍摄微单相机",
        },
        {
            "brand": "Fujifilm",
            "model": "X-T5",
            "name": "Fujifilm X-T5 微单相机",
            "description": "高像素复古机身微单相机",
        },
        {
            "brand": "GoPro",
            "model": "HERO11 Black",
            "name": "GoPro HERO11 Black 运动相机",
            "description": "防水防抖 5.3K 运动相机",
        },
        {
            "brand": "DJI",
            "model": "Osmo Action 4",
            "name": "DJI Osmo Action 4 运动相机",
            "description": "防水防抖 4K 运动相机",
        },
        {
            "brand": "Insta360",
            "model": "X3",
            "name": "Insta360 X3 全景相机",
            "description": "5.7K 防水全景运动相机",
        },
        {
            "brand": "Panasonic",
            "model": "Lumix GH6",
            "name": "Panasonic Lumix GH6 微单相机",
            "description": "视频创作 M4/3 微单相机",
        },
    ],
    "router": [
        {
            "brand": "TP-Link",
            "model": "Archer AX73",
            "name": "TP-Link Archer AX73 Wi-Fi 6 路由器",
            "description": "AX5400 双频 Wi-Fi 6 路由器",
        },
        {
            "brand": "TP-Link",
            "model": "Deco X60",
            "name": "TP-Link Deco X60 Mesh 路由器",
            "description": "AX3000 Wi-Fi 6 Mesh 路由器",
        },
        {
            "brand": "ASUS",
            "model": "RT-AX88U",
            "name": "ASUS RT-AX88U Wi-Fi 6 路由器",
            "description": "AX6000 双频电竞路由器",
        },
        {
            "brand": "Netgear",
            "model": "Nighthawk RAX50",
            "name": "Netgear Nighthawk RAX50 路由器",
            "description": "AX5400 Wi-Fi 6 家用路由器",
        },
        {
            "brand": "Linksys",
            "model": "Hydra Pro 6",
            "name": "Linksys Hydra Pro 6 Wi-Fi 6 路由器",
            "description": "Mesh Ready 双频 Wi-Fi 6 路由器",
        },
        {
            "brand": "Eero",
            "model": "Eero 6+",
            "name": "Eero 6+ Mesh 路由器",
            "description": "双频 Wi-Fi 6 Mesh 路由器",
        },
        {
            "brand": "Google",
            "model": "Nest Wifi Pro",
            "name": "Google Nest Wifi Pro 路由器",
            "description": "Wi-Fi 6E Mesh 路由器",
        },
        {
            "brand": "Ubiquiti",
            "model": "UniFi Dream Router",
            "name": "Ubiquiti UniFi Dream Router",
            "description": "一体化企业网络路由器",
        },
    ],
    "accessory": [
        {
            "brand": "Apple",
            "model": "Magic Keyboard",
            "name": "Apple Magic Keyboard 键盘",
            "description": "蓝牙无线妙控键盘",
        },
        {
            "brand": "Apple",
            "model": "Pencil 2nd Generation",
            "name": "Apple Pencil 第二代 触控笔",
            "description": "iPad 磁吸触控笔配件",
        },
        {
            "brand": "Logitech",
            "model": "K380",
            "name": "Logitech K380 蓝牙键盘",
            "description": "多设备蓝牙无线键盘",
        },
        {
            "brand": "Logitech",
            "model": "MX Keys Mini",
            "name": "Logitech MX Keys Mini 无线键盘",
            "description": "紧凑型蓝牙办公键盘",
        },
        {
            "brand": "SanDisk",
            "model": "Extreme Portable SSD",
            "name": "SanDisk Extreme Portable SSD 移动固态硬盘",
            "description": "USB-C 便携移动固态硬盘",
        },
        {
            "brand": "WD",
            "model": "My Passport SSD",
            "name": "WD My Passport SSD 移动固态硬盘",
            "description": "便携 USB-C 移动固态硬盘",
        },
        {
            "brand": "UGREEN",
            "model": "USB-C 9-in-1 Dock",
            "name": "UGREEN USB-C 九合一扩展坞",
            "description": "HDMI 网口读卡器多功能扩展坞",
        },
        {
            "brand": "Anker",
            "model": "555 USB-C Hub",
            "name": "Anker 555 USB-C Hub 扩展坞",
            "description": "8 合 1 USB-C 多功能扩展坞",
        },
        {
            "brand": "Belkin",
            "model": "USB-C to HDMI Adapter",
            "name": "Belkin USB-C 转 HDMI 适配器",
            "description": "USB-C 视频转接配件",
        },
        {
            "brand": "Kingston",
            "model": "DataTraveler Max",
            "name": "Kingston DataTraveler Max U 盘",
            "description": "USB-C 高速闪存盘",
        },
    ],
}

for category, profiles in ADDITIONAL_REAL_PRODUCT_PROFILES.items():
    REAL_PRODUCT_PROFILES.setdefault(category, []).extend(profiles)

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


def choose_real_product_profile(category: str, rng: random.Random, real_name_rate: float) -> dict[str, str] | None:
    profiles = REAL_PRODUCT_PROFILES.get(category, [])
    if not profiles or rng.random() >= real_name_rate:
        return None
    return weighted_pick(rng, profiles)


def build_base_record(
    category: str,
    index: int,
    rng: random.Random,
    *,
    use_real_product_name: bool = False,
    real_name_rate: float = DEFAULT_REAL_NAME_RATE,
) -> dict[str, str]:
    config = CATEGORY_CONFIG[category]
    real_profile = (
        choose_real_product_profile(category, rng, real_name_rate)
        if use_real_product_name
        else None
    )

    if real_profile:
        brand = real_profile["brand"]
        model = real_profile["model"]
        name = real_profile["name"]
        description = real_profile["description"]
    else:
        brand = weighted_pick(rng, config["brands"])
        model = weighted_pick(rng, config["models"])
        descriptor = weighted_pick(rng, config["descriptions"])
        name = f"{brand}{model}{config['name_suffix']}"
        description = f"{descriptor}{config['name_suffix']}"

    record = {
        "sample_id": build_id(category, index),
        "split": "train",
        "category": category,
        "name": name,
        "description": description,
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


def pass_record(
    category: str,
    index: int,
    rng: random.Random,
    real_name_rate: float = DEFAULT_REAL_NAME_RATE,
) -> dict[str, str]:
    record = build_base_record(
        category,
        index,
        rng,
        use_real_product_name=True,
        real_name_rate=real_name_rate,
    )
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


def review_record(
    category: str,
    index: int,
    rng: random.Random,
    real_name_rate: float = DEFAULT_REAL_NAME_RATE,
) -> dict[str, str]:
    record = build_base_record(
        category,
        index,
        rng,
        use_real_product_name=True,
        real_name_rate=real_name_rate,
    )
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


def records_for_category(
    category: str,
    count: int,
    start_index: int,
    rng: random.Random,
    real_name_rate: float,
) -> list[dict[str, str]]:
    pass_count = int(count * 0.4)
    review_count = int(count * 0.35)
    fail_count = count - pass_count - review_count

    builders = [pass_record] * pass_count + [review_record] * review_count + [fail_record] * fail_count
    rng.shuffle(builders)

    rows: list[dict[str, str]] = []
    for local_index, builder in enumerate(builders):
        absolute_index = start_index + local_index
        if builder in {pass_record, review_record}:
            row = builder(category, absolute_index, rng, real_name_rate)
        else:
            row = builder(category, absolute_index, rng)
        row["sample_id"] = build_id(category, absolute_index)
        row["split"] = determine_split(local_index, count)
        apply_realism_noise(row, rng)
        rows.append(row)
    return rows


def generate_rows(
    total_rows: int,
    seed: int,
    real_name_rate: float = DEFAULT_REAL_NAME_RATE,
) -> list[dict[str, str]]:
    if total_rows < len(CATEGORIES):
        raise ValueError("total_rows must be at least the number of categories")
    if real_name_rate < 0 or real_name_rate > 1:
        raise ValueError("real_name_rate must be between 0 and 1")

    rng = random.Random(seed)
    per_category_base = total_rows // len(CATEGORIES)
    remainder = total_rows % len(CATEGORIES)

    rows: list[dict[str, str]] = []
    absolute_index = 1
    for category_index, category in enumerate(CATEGORIES):
        count = per_category_base + (1 if category_index < remainder else 0)
        rows.extend(records_for_category(category, count, absolute_index, rng, real_name_rate))
        absolute_index += count
    return rows


def load_real_fail_rows(input_path: Path, max_rows: int, seed: int) -> list[dict[str, str]]:
    if not input_path.exists():
        raise FileNotFoundError(
            f"Real FAIL input not found: {input_path}. Run cpsc_recall_importer.py first."
        )

    rows: list[dict[str, str]] = []
    with input_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            if str(row.get("audit_label", "")).strip().upper() != "FAIL":
                continue
            category = str(row.get("category", "")).strip()
            if category not in CATEGORIES:
                continue

            normalized = {field: str(row.get(field, "") or "") for field in FIELDNAMES}
            normalized["category"] = category
            normalized["audit_label"] = "FAIL"
            if normalized["split"] not in {"train", "val", "test"}:
                normalized["split"] = determine_split(len(rows), max_rows or 1)
            if not normalized["sample_id"]:
                normalized["sample_id"] = f"REAL-FAIL-{len(rows) + 1:05d}"
            rows.append(normalized)

    rng = random.Random(seed)
    rng.shuffle(rows)
    if max_rows > 0:
        return rows[:max_rows]
    return rows


def load_real_fail_sources(input_paths: list[Path], max_rows_per_source: int, seed: int) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for source_index, input_path in enumerate(input_paths):
        source_rows = load_real_fail_rows(input_path, max_rows_per_source, seed + source_index)
        rows.extend(source_rows)
        print(f"Included {len(source_rows)} real-world FAIL rows from {input_path}")
    return rows


def write_csv(rows: list[dict[str, str]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a synthetic electronic audit dataset.")
    parser.add_argument("--rows", type=int, default=DEFAULT_TOTAL, help="Total rows to generate")
    parser.add_argument("--seed", type=int, default=SEED, help="Random seed")
    parser.add_argument("--output", default=str(OUTPUT_PATH), help="Output CSV path")
    parser.add_argument(
        "--real-name-rate",
        type=float,
        default=DEFAULT_REAL_NAME_RATE,
        help=(
            "Share of synthetic PASS/REVIEW rows that use real common product names. "
            "Synthetic FAIL rows still use fictional names; real FAIL rows come from recall imports."
        ),
    )
    parser.add_argument(
        "--include-real-fail",
        action="store_true",
        help="Append normalized real-world FAIL recall samples to the generated dataset",
    )
    parser.add_argument(
        "--real-fail-input",
        action="append",
        dest="real_fail_inputs",
        help=(
            "Path to normalized real-world FAIL samples. "
            "Can be passed multiple times. Defaults to CPSC recall samples when omitted."
        ),
    )
    parser.add_argument(
        "--max-real-fail-rows",
        type=int,
        default=DEFAULT_MAX_REAL_FAIL_ROWS,
        help="Maximum real-world FAIL rows to append per input source; 0 means all rows",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rows = generate_rows(args.rows, args.seed, args.real_name_rate)
    if args.include_real_fail:
        real_fail_inputs = [Path(path) for path in (args.real_fail_inputs or [str(DEFAULT_REAL_FAIL_INPUT)])]
        real_fail_rows = load_real_fail_sources(
            real_fail_inputs,
            args.max_real_fail_rows,
            args.seed,
        )
        rows.extend(real_fail_rows)
    write_csv(rows, Path(args.output))
    print(f"Generated {len(rows)} rows -> {args.output}")


if __name__ == "__main__":
    main()
