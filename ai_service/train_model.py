# ai_service/train_model.py
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import make_pipeline

# 1. 准备“合成”训练数据
# 这里的逻辑是：包含“合格”、“符合标准”等词的是正样本，包含“易燃”、“爆炸”、“不合格”的是负样本。
texts = [
    "该电子产品符合 GB/T 18287-2013 标准，电池安全测试合格。",
    "经过检测，各项指标均在安全范围内，准予上市。",
    "产品通过 CCC 认证，绝缘性能良好，无漏电风险。",
    "检测报告：合格。符合国际电工委员会 IEC 标准。",
    "质量上乘，经过 24 小时老化测试，性能稳定。",

    "警报：电池在高温测试中发生起火爆炸，严重安全隐患。",
    "检测结果：不合格。外壳绝缘电阻低于标准值，有触电风险。",
    "该批次产品辐射超标，禁止在市场上流通。",
    "未通过耐压测试，电路板设计存在缺陷。",
    "存在严重质量问题，建议立即召回。",
]

# 标签：1 = 通过 (Approved), 0 = 拒绝 (Rejected)
labels = [1, 1, 1, 1, 1, 0, 0, 0, 0, 0]

# 2. 构建机器学习管道 (TF-IDF + 朴素贝叶斯)
# 这正是你蓝图中要求的算法组合
model = make_pipeline(TfidfVectorizer(), MultinomialNB())

# 3. 训练模型
print("正在训练 AI 审核模型...")
model.fit(texts, labels)

# 4. 保存模型到文件
joblib.dump(model, 'audit_model.pkl')
print("✅ 模型已保存为 audit_model.pkl")

# 5. 简单测试
test_text = "本产品经过严格测试，符合安全标准，合格。"
prediction = model.predict([test_text])[0]
print(f"测试文本: '{test_text}' -> 预测结果: {'通过' if prediction == 1 else '拒绝'}")