# PROJECT_REFACTOR_IMPLEMENTATION_PLAN

## 文档目的

本文档基于当前仓库代码现状编写，目标是为后续重构和功能补强提供一份可分批执行、可独立测试、可回滚的实施计划。

执行原则：

- 后续代码修改必须按本文档的批次推进，避免跨批次一次性大改。
- 每一批都应先完成实现、测试、验收，再进入下一批。
- 除非批次说明明确要求，否则不同时修改数据库模型、合约、前端和 AI 服务。
- 优先保持现有测试通过，并在每一批补齐新增测试。

本文档扫描范围包括：

- 前端页面与组件
- 后端 `routes / controllers / services / models`
- Python AI 审核服务
- Solidity 合约
- 测试文件
- 配置文件与脚本

---

## 1. 当前系统能力总结

### 1.1 已实现功能

#### 1.1.1 账号、角色与权限

- 买家、卖家自助注册与登录。
- 卖家注册可提交电子产品经营资质摘要与资质材料 IPFS 哈希。
- 卖家注册后进入待审核状态，由监管员或管理员审批。
- 基于 JWT 的鉴权和基于角色的接口权限控制已接入。
- 监管端可查看待审核卖家、黑名单卖家，并执行移出黑名单。

#### 1.1.2 商品发布与电子产品合规字段

- 卖家可发布电子产品，字段已覆盖品牌、型号、序列号、批次、CCC、能效、RoHS、检验机构、检验结论、电池安全、充电安全、翻新/二手、维修声明等。
- 商品提交时会上传检测报告与资质文件到 IPFS。
- 商品支持重新提交、补货、下架、召回。
- 商品审核支持结构化原因码与缺失项检查。

#### 1.1.3 AI 预审

- 后端在商品新增和重新提交时会调用 Python AI 服务。
- AI 服务可解析 PDF 或文本内容，结合结构化字段做分类预测。
- AI 服务返回 `PASS / REVIEW / FAIL`、置信度、通过概率、原因提示。
- AI 结果已纳入后端审核分支与审计日志。

#### 1.1.4 区块链与链上状态

- 合约支持卖家注册、商品创建、商品审核、商品下架、召回、维修记录、翻新声明、补货、购买、确认收货、评价、投诉、裁决、卖家恢复。
- 后端通过 `web3` 与合约交互，并支持开发环境使用解锁账户或私钥签名。
- 商品追溯页已读取链上摘要字段，如品牌、型号、类别、设备哈希、CCC 哈希、风险等级、召回标记等。

#### 1.1.5 市场、订单、投诉与售后

- 首页支持商品分页、筛选、排序、二维码追溯入口。
- 买家可购买商品、确认收货、评价、发起投诉。
- 卖家可发货、填写物流信息、提交投诉答辩、记录售后服务。
- 监管员可查看投诉列表并进行裁决。
- 订单与售后记录已可在追溯页串联展示。

#### 1.1.6 审计与监管看板

- 系统已记录登录、商品审核、商品下架、召回、订单发货、投诉、售后、文件上传等审计日志。
- 监管首页包含统计卡片、趋势图、投诉类型分布、审计日志导出。
- 商品追溯页已聚合商品、订单、售后、召回、审计时间线。

#### 1.1.7 测试与脚本

- 后端已有 Node 原生测试，覆盖注册、审核统计、商品追溯、投诉、售后、召回等核心流程。
- 前端已有 React Testing Library 测试，覆盖商品发布、注册、首页召回、订单中心、追溯页、监管组件等。
- 合约已有 Truffle 测试，覆盖电子产品链上摘要、召回、补货、卖家恢复等。
- 根目录已有聚合测试命令，可分别跑后端、前端、区块链测试。

### 1.2 关键文件位置

| 模块 | 关键文件 |
| --- | --- |
| 前端路由入口 | `frontend/src/App.js` |
| 登录/注册 | `frontend/src/pages/Login.js` `frontend/src/pages/Register.js` |
| 首页市场与监管总览 | `frontend/src/pages/Home.js` |
| 商品发布 | `frontend/src/pages/AddProduct.js` |
| 卖家商品管理 | `frontend/src/pages/MyProducts.js` |
| 订单中心 | `frontend/src/pages/OrderCenter.js` |
| 追溯页面 | `frontend/src/pages/TracePage.js` |
| 监管组件 | `frontend/src/components/Dashboard.js` `frontend/src/components/RegulatorReviewQueues.js` `frontend/src/components/BlacklistSellerManager.js` |
| 前端服务层 | `frontend/src/services/*.js` |
| 后端入口 | `backend/server.js` |
| 鉴权与用户路由 | `backend/routes/auth.routes.js` `backend/controllers/auth.controller.js` |
| 商品、订单、投诉、售后路由 | `backend/routes/product.routes.js` `backend/controllers/product.controller.js` |
| 文件上传 | `backend/routes/file.routes.js` `backend/controllers/file.controller.js` |
| 审计日志与统计 | `backend/routes/audit.routes.js` `backend/controllers/audit.controller.js` |
| 核心服务 | `backend/services/audit.service.js` `backend/services/chain.service.js` `backend/services/pinata.service.js` `backend/services/seller-blacklist.service.js` |
| 数据模型 | `backend/models/*.js` |
| 环境与运行时配置 | `backend/config/*.js` `.env.example` `backend/.env.example` `frontend/.env.example` |
| AI 服务入口 | `ai_service/app.py` |
| AI 特征与模型 | `ai_service/model_utils.py` `ai_service/train_model.py` |
| 合约 | `blockchain/contracts/ProductRegulation.sol` |
| 合约部署 | `blockchain/migrations/1_deploy.js` `blockchain/truffle-config.js` |
| 后端测试 | `backend/test/*.test.js` |
| 前端测试 | `frontend/src/pages/*.test.js` `frontend/src/components/*.test.js` |
| 合约测试 | `blockchain/test/product_regulation.test.js` |

### 1.3 当前测试情况

基于本次扫描时的实际执行结果：

| 模块 | 命令 | 当前结果 |
| --- | --- | --- |
| 后端 | `npm --prefix backend test` | 通过，11/11 |
| 前端 | `npm --prefix frontend test -- --watchAll=false` | 通过，8 个套件、11/11 |
| 合约 | `npx truffle test .\test\product_regulation.test.js --config .\truffle-config.js --network development` | 通过，6/6 |

当前测试结论：

- 核心业务流已有基础测试护栏。
- 现有测试更偏“功能存在性验证”，对并发、一致性、异常补偿、权限边界、真实支付/退款并未形成充分覆盖。
- 后续每一批实施都必须新增对应测试，不能只依赖当前测试集。

---

## 2. 当前主要问题

### 2.1 支付/退款闭环缺失

当前状态：

- `purchaseProduct` 会创建订单、扣减库存、调用链上购买，但没有真实支付状态机。
- `resolveComplaint` 会把订单状态改为退款，但没有退款记录、退款金额、退款渠道、退款时间、退款失败重试。
- 前端也没有支付中、已支付、退款中、已退款、退款失败等用户可见状态。

影响：

- 业务上无法形成完整交易闭环。
- 投诉裁决的“退款”只停留在状态变更层面。
- 难以为后续接入真实钱包支付、第三方支付、链上托管预留扩展点。

### 2.2 链上/数据库/IPFS 一致性与补偿机制不足

当前状态：

- 商品提交、购买、召回、售后、投诉等流程中，链上、数据库、IPFS、审计日志之间缺少统一事务边界。
- 失败时多为直接抛错，没有补偿任务、重试队列、人工对账工具。
- 上传文件与业务实体写入分离，存在“文件已上传但业务失败”或“链上成功但数据库未落地”的风险。
- `runtime-schema.js` 使用运行时补列方式维持结构，适合开发期，不适合作为长期生产迁移方案。

影响：

- 会产生孤儿 IPFS 文件、数据库脏记录、链上与数据库状态不一致。
- 运营与监管难以追踪异常并人工修复。

### 2.3 AI 服务异常时直接 FAIL

当前状态：

- 后端 `callAiAuditService` 捕获异常后返回固定 `FAIL` 结果。
- 商品新增或重提时，AI 不可用会被当作审核失败处理。

影响：

- AI 服务的网络抖动、模型未加载、服务进程退出都会直接阻塞卖家业务。
- 会把“系统异常”误判成“商品不合规”，造成错误业务后果。

### 2.4 库存并发与超卖风险

当前状态：

- `purchaseProduct`、`restockProduct`、`delistProduct`、`recallProduct` 等流程未显式使用数据库事务和行锁。
- 当前测试未验证并发下的库存扣减与重复购买边界。

影响：

- 多个买家同时下单时存在超卖风险。
- 召回/下架与购买并发时，可能出现状态穿透。

### 2.5 召回通知闭环缺失

当前状态：

- 监管员可以召回商品，前端首页和追溯页可见召回状态。
- 但系统没有向历史购买用户推送通知，没有站内消息中心，没有“召回处理中/已联系/已退款/已维修”等后续流转。

影响：

- 召回只有标记，没有履约闭环。
- 难以支撑监管追责与用户保护。

### 2.6 投诉与售后入口规则不够合理

当前状态：

- 买家投诉入口主要集中在订单锁定阶段。
- 售后记录主要由卖家或监管员记录，买家缺少正式的售后申请入口。
- 投诉、售后、退款之间缺少清晰分层。

影响：

- 用户路径不自然，确认收货后反而缺少合理的争议与售后入口。
- 业务规则难以扩展到维修、换货、保修、退款、质量争议等更细分场景。

### 2.7 卖家重提页不能重新上传文件

当前状态：

- `MyProducts.js` 中重提弹窗只允许直接编辑 `ipfsHash` 和 `qualificationHash`。
- 卖家无法在重提时重新上传检测报告或资质文件并自动替换哈希。

影响：

- 真实业务场景下可用性很差。
- 卖家必须手工维护 IPFS 哈希，容易出错。

### 2.8 监管后台高级检索不足

当前状态：

- 后端审计日志接口已支持部分筛选参数，但前端未提供完整高级检索入口。
- 商品、投诉、召回、黑名单对象也缺少统一筛选视图。

影响：

- 监管端难以快速定位问题对象、时间范围、异常动作和处理结果。
- 审计日志中心更像展示板，而不是可操作的监管台。

### 2.9 管理员/监管员初始化与用户管理不足

当前状态：

- 系统代码中有 `admin` 与 `regulator` 角色。
- 但缺少初始化脚本、用户管理界面、冻结/解冻/重置密码/角色分配等完整管理能力。

影响：

- 新环境部署后的管理账号准备不规范。
- 运维和后续权限治理成本高。

### 2.10 中文文案乱码与编码问题

当前状态：

- 多个前端页面和组件中已出现明显乱码，用户可见文案不稳定。
- 测试代码中也直接依赖乱码文案，后续修改风险较高。

影响：

- 演示、验收和用户体验直接受损。
- 影响组件可维护性和测试稳定性。

---

## 3. 推荐实施顺序

推荐严格按以下十个批次推进：

| 批次 | 名称 | 核心目标 | 特点 |
| --- | --- | --- | --- |
| 第一批 | AI 预审异常降级为人工待审 | 先解决“系统异常误伤业务” | 改动小、收益高、无须改合约 |
| 第二批 | 库存并发保护与购买流程加固 | 先守住库存和订单一致性 | 后端局部重构，可独立测试 |
| 第三批 | 支付/退款闭环设计与最小实现 | 建立可追踪的交易资金状态 | 需要新增模型，但可不先改合约 |
| 第四批 | 链上/数据库/IPFS 对账与补偿机制 | 建立异常恢复能力 | 新增后台任务和对账工具 |
| 第五批 | 召回通知闭环 | 让召回从标记走向履约 | 以前后端为主，风险可控 |
| 第六批 | 售后/投诉入口规则重构 | 梳理用户路径和业务规则 | 需要新增售后申请模型和界面 |
| 第七批 | 卖家重提页重新上传文件 | 解决高频可用性问题 | 改动聚焦，前后端联动有限 |
| 第八批 | 监管后台高级检索 | 提升监管操作效率 | 主要是查询接口和前端交互 |
| 第九批 | 管理员/监管员初始化与用户管理 | 补齐环境初始化和治理能力 | 需要脚本、接口、页面 |
| 第十批 | 中文乱码与用户可见文案体验优化 | 最后统一清理文案和编码 | 适合在业务路径稳定后集中处理 |

排序原则：

- 先修正错误业务后果和系统可靠性问题。
- 再补交易闭环与补偿能力。
- 再增强监管能力和用户体验。
- 将高风险结构性改动拆散，避免同一批同时触碰核心交易、合约、通知、文案。

---

## 4. 分批实施方案

## 第一批：AI 预审异常降级为人工待审

| 项 | 内容 |
| --- | --- |
| 批次名称 | 第一批：AI 预审异常降级为人工待审 |
| 目标 | 将 AI 服务不可用从“直接 FAIL”改为“转人工待审”，避免误伤卖家正常提交流程 |
| 涉及文件 | `backend/controllers/product.controller.js` `backend/services/audit.service.js` `backend/test/product.controller.test.js` `frontend/src/pages/AddProduct.js` `frontend/src/pages/MyProducts.js` `frontend/src/components/RegulatorReviewQueues.js` |
| 具体修改点 | 1. 重构 `callAiAuditService` 返回结构，区分 `serviceUnavailable`、`shouldBlock`、`requiresManualReview`。 2. 当 AI 调用异常时，商品新增与重提均进入 `auditStatus=0` 待人工审核，而不是 `auditStatus=2`。 3. 在商品 `auditReason` 中写入“AI 服务异常，转人工待审”。 4. 新增审计动作，例如 `PRODUCT_AI_DEGRADED_TO_MANUAL_REVIEW`。 5. 前端提示语改为“AI 预审暂不可用，已转人工审核”。 |
| 数据库/模型是否需要变化 | 否。优先复用现有 `auditStatus` 和 `auditReason` 字段，不新增表结构 |
| 合约是否需要变化 | 否 |
| 前端是否需要变化 | 是。需要调整新增商品和重提后的提示文案，必要时在监管审核队列中显示“AI 异常转人工”提示 |
| 后端是否需要变化 | 是。核心逻辑位于 `product.controller.js` |
| AI 服务是否需要变化 | 否。第一批不修改 Python 服务逻辑，只修改后端调用降级策略 |
| 测试方案 | 1. 后端新增“AI 调用异常时商品进入待审核”的测试。 2. 前端新增/修改提交成功提示测试。 3. 回归现有商品新增、重提、监管审核测试 |
| 验收标准 | AI 服务关闭或报错时，卖家仍可提交商品；商品进入待审核；监管员可正常看到该商品；现有测试全部通过 |
| 风险点 | 需要防止把真正的 AI `FAIL` 与“服务异常”混淆 |
| 回滚方式 | 回滚 `product.controller.js` 中新增分支和审计动作；由于无模型变更，代码级回滚即可 |

### 第一批执行建议

- 只改后端审核降级和前端提示，不在本批引入健康检查、熔断、监控告警。
- 审计日志中要明确区分“AI 判定不通过”和“AI 不可用转人工”。

---

## 第二批：库存并发保护与购买流程加固

| 项 | 内容 |
| --- | --- |
| 批次名称 | 第二批：库存并发保护与购买流程加固 |
| 目标 | 防止超卖、状态穿透和并发下的数据不一致 |
| 涉及文件 | `backend/controllers/product.controller.js` `backend/models/index.js` `backend/test/product.controller.test.js` |
| 具体修改点 | 1. 为 `purchaseProduct`、`restockProduct`、`delistProduct`、`recallProduct` 增加 Sequelize 事务。 2. 在购买和补货流程中对商品记录使用行级锁。 3. 在购买流程中把“读取商品、校验库存、创建订单、扣减库存”放进同一事务。 4. 对召回和下架流程增加事务，避免和购买并发冲突。 5. 对重复提交购买请求增加基础幂等防护，可先通过服务端校验同一用户短时间内的重复请求或在最小方案中记录请求指纹。 |
| 数据库/模型是否需要变化 | 最小方案建议不改模型；如需要幂等键，可在本批末尾再评估新增字段 |
| 合约是否需要变化 | 否 |
| 前端是否需要变化 | 否。除非增加更明确的购买失败提示 |
| 后端是否需要变化 | 是，本批重点在后端控制器与事务边界 |
| AI 服务是否需要变化 | 否 |
| 测试方案 | 1. 后端增加库存不足边界测试。 2. 增加购买与召回/下架顺序测试。 3. 可补一个伪并发测试，验证第二次购买在库存归零后失败 |
| 验收标准 | 单库存商品不出现双订单；召回商品无法继续购买；补货、购买、下架、召回后的库存状态可预测 |
| 风险点 | 事务改造会影响多个控制器分支，必须避免把查询逻辑和上链逻辑随意混入事务导致阻塞时间过长 |
| 回滚方式 | 回滚事务包装代码和锁逻辑；如本批未改模型，则仍可纯代码回滚 |

### 第二批执行建议

- 优先保护数据库一致性，再讨论链上并发。
- 本批不引入消息队列，只做同步事务加固。

---

## 第三批：支付/退款闭环设计与最小实现

| 项 | 内容 |
| --- | --- |
| 批次名称 | 第三批：支付/退款闭环设计与最小实现 |
| 目标 | 建立订单支付与退款状态机，至少做到“有状态、有记录、可追踪” |
| 涉及文件 | `backend/models/order.model.js` `backend/models/index.js` `backend/config/runtime-schema.js` `backend/controllers/product.controller.js` `backend/services/audit.service.js` `frontend/src/pages/OrderCenter.js` `frontend/src/pages/Home.js` `backend/test/product.controller.test.js` `frontend/src/pages/OrderCenter.test.js` |
| 具体修改点 | 1. 为订单增加支付相关字段，建议至少包含 `paymentStatus`、`paymentMethod`、`paymentReference`、`paidAt`、`refundStatus`、`refundedAt`、`refundAmount`。 2. 购买成功后将订单状态与支付状态分离，不再用订单状态隐式表示支付完成。 3. 投诉裁决退款时更新退款状态和退款金额。 4. 前端订单中心展示支付中、已支付、退款中、已退款。 5. 审计日志记录支付与退款动作。 |
| 数据库/模型是否需要变化 | 是。推荐优先直接扩展 `orders` 表，作为最小实现；不在本批先拆 `payment_records` 子表 |
| 合约是否需要变化 | 否。最小实现只建立平台内支付/退款状态闭环，不强行在本批做链上托管改造 |
| 前端是否需要变化 | 是。订单中心与商品购买成功提示都要展示支付/退款状态 |
| 后端是否需要变化 | 是。购买、确认收货、投诉裁决等流程都要改 |
| AI 服务是否需要变化 | 否 |
| 测试方案 | 1. 后端增加支付状态初始化和退款状态更新测试。 2. 前端增加订单状态展示测试。 3. 回归投诉裁决和购买测试 |
| 验收标准 | 每笔订单都能看到明确支付状态；退款裁决后能看到退款状态与时间；现有购买与投诉流程继续可用 |
| 风险点 | 现有 `status` 已承担过多含义，实施时要避免一次性重写整个订单状态机 |
| 回滚方式 | 保留新增字段的前提下可回滚业务代码；若需彻底回滚，则通过迁移脚本移除新增字段，并回滚前端状态展示 |

### 第三批执行建议

- 本批只做“最小支付/退款闭环”，不接真实第三方支付，不改链上资金托管。
- 需要在文档和代码中明确：订单状态代表业务阶段，支付字段代表资金状态，退款字段代表资金返还阶段。

---

## 第四批：链上/数据库/IPFS 对账与补偿机制

| 项 | 内容 |
| --- | --- |
| 批次名称 | 第四批：链上/数据库/IPFS 对账与补偿机制 |
| 目标 | 当链上、数据库、IPFS 任一环节失败时，可发现、可重试、可人工修复 |
| 涉及文件 | `backend/models/index.js` `backend/config/runtime-schema.js` `backend/controllers/product.controller.js` `backend/controllers/file.controller.js` `backend/services/chain.service.js` `backend/services/pinata.service.js` `backend/services/audit.service.js` `backend/routes/*.js` `backend/test/*.test.js` `package.json` |
| 具体修改点 | 1. 新增补偿任务或对账任务模型，建议命名为 `sync_jobs` 或 `integration_jobs`，记录目标对象、步骤、状态、重试次数、错误信息。 2. 在商品创建、购买、召回、售后、文件上传等关键流程中，当链上或数据库写入失败时落补偿任务。 3. 新增后台脚本或接口用于扫描未完成任务并重试。 4. 新增“手动重放/重试”入口，仅供管理员/监管员使用。 5. 审计日志记录补偿任务创建与完成情况。 |
| 数据库/模型是否需要变化 | 是。建议新增补偿任务表，而不是继续把状态塞进原业务表 |
| 合约是否需要变化 | 否 |
| 前端是否需要变化 | 最小实现可不改前端；如增加后台人工重试入口，则后续可在监管端接入 |
| 后端是否需要变化 | 是，本批以后端为主 |
| AI 服务是否需要变化 | 否 |
| 测试方案 | 1. 后端新增“链上失败生成补偿任务”“补偿任务重试成功”的单元测试。 2. 脚本或任务执行器增加最小可运行测试 |
| 验收标准 | 人为模拟链上或 IPFS 失败时，系统不会静默丢失；可看到待补偿任务并执行重试 |
| 风险点 | 如果设计过重，会演变成大规模异步架构改造，因此必须控制在“任务记录 + 手动/定时重试”范围 |
| 回滚方式 | 回滚补偿任务相关服务与路由；保留任务表不影响主业务；如需彻底回滚，再删除表结构 |

### 第四批执行建议

- 先做“记录异常 + 支持重试”，不在本批上消息队列。
- 逐步替代运行时补列思路，开始为后续正式迁移体系做准备。

---

## 第五批：召回通知闭环

| 项 | 内容 |
| --- | --- |
| 批次名称 | 第五批：召回通知闭环 |
| 目标 | 让召回从“商品标记”升级为“通知到已购用户并可跟踪处理” |
| 涉及文件 | `backend/models/index.js` `backend/config/runtime-schema.js` `backend/controllers/product.controller.js` `backend/routes/product.routes.js` `frontend/src/pages/Home.js` `frontend/src/pages/OrderCenter.js` `frontend/src/services/product.service.js` `backend/test/product.controller.test.js` `frontend/src/pages/OrderCenter.test.js` |
| 具体修改点 | 1. 新增召回通知模型，建议记录 `buyerId`、`productId`、`orderId`、`status`、`notifiedAt`、`acknowledgedAt`。 2. 商品召回时为历史订单买家生成通知。 3. 买家订单中心增加“召回通知”展示和已读/确认处理入口。 4. 监管端可看到召回涉及用户数量与处理状态。 5. 后端提供买家查询个人召回通知接口。 |
| 数据库/模型是否需要变化 | 是，建议新增 `recall_notifications` 表 |
| 合约是否需要变化 | 否 |
| 前端是否需要变化 | 是，至少改订单中心；监管首页可后续补概览 |
| 后端是否需要变化 | 是 |
| AI 服务是否需要变化 | 否 |
| 测试方案 | 1. 后端增加“召回时生成通知”的测试。 2. 前端增加买家能看到召回通知的测试 |
| 验收标准 | 商品召回后，相关买家可看到召回通知；通知有明确状态；旧追溯页仍可正常展示召回信息 |
| 风险点 | 大量历史订单生成通知时要注意性能，可先按同步创建，再视数据量决定是否异步化 |
| 回滚方式 | 回滚通知生成逻辑与前端展示；通知表可保留不影响核心交易 |

### 第五批执行建议

- 本批先做站内通知，不强制接入邮件、短信、企业微信等外部通道。
- 通知状态建议最小化为：`pending / viewed / acknowledged / closed`。

---

## 第六批：售后/投诉入口规则重构

| 项 | 内容 |
| --- | --- |
| 批次名称 | 第六批：售后/投诉入口规则重构 |
| 目标 | 区分“售后申请”和“监管投诉”，让用户路径更自然，规则更可扩展 |
| 涉及文件 | `backend/models/index.js` `backend/models/after-sales-record.model.js` `backend/config/runtime-schema.js` `backend/controllers/product.controller.js` `backend/routes/product.routes.js` `frontend/src/pages/OrderCenter.js` `frontend/src/services/product.service.js` `backend/test/product.controller.test.js` `frontend/src/pages/OrderCenter.test.js` |
| 具体修改点 | 1. 新增买家发起售后申请的能力，建议单独建 `after_sales_requests` 表。 2. 投诉入口规则改为：高风险问题可直接投诉，普通履约/质量问题先走售后申请。 3. 卖家响应售后申请，监管员在必要时升级为投诉处理。 4. 订单中心分开展示“售后申请”“投诉记录”“卖家售后记录”。 5. 更新状态机和提示语，避免把所有争议都塞到投诉流程。 |
| 数据库/模型是否需要变化 | 是，建议新增 `after_sales_requests` 表；原 `after_sales_records` 继续保留，作为处理记录 |
| 合约是否需要变化 | 否。本批仍以平台业务流为主，合约只保留最终投诉裁决和维修记录能力 |
| 前端是否需要变化 | 是，本批前端变更较大，主要集中在订单中心 |
| 后端是否需要变化 | 是 |
| AI 服务是否需要变化 | 否 |
| 测试方案 | 1. 后端新增买家创建售后申请、卖家响应、升级投诉测试。 2. 前端新增不同状态下入口展示测试 |
| 验收标准 | 买家在确认收货后仍可发起售后；非高风险问题默认先走售后；投诉与售后记录区分清晰 |
| 风险点 | 容易牵动订单状态机，必须尽量避免重写全部老状态。 推荐在原状态机外增加售后申请独立状态 |
| 回滚方式 | 回滚新售后申请逻辑；旧投诉与售后记录功能仍可继续运行；新增表结构可保留但停止使用 |

### 第六批执行建议

- 先建立“售后申请”和“投诉”两个概念的清晰边界。
- 保留原有投诉接口一段时间，通过前端入口和后端校验逐步迁移。

---

## 第七批：卖家重提页重新上传文件

| 项 | 内容 |
| --- | --- |
| 批次名称 | 第七批：卖家重提页重新上传文件 |
| 目标 | 让卖家在商品重提时可以重新上传检测报告和资质文件，而不是手填 IPFS 哈希 |
| 涉及文件 | `frontend/src/pages/MyProducts.js` `frontend/src/services/file.service.js` `frontend/src/services/product.service.js` `backend/routes/product.routes.js` `backend/controllers/product.controller.js` `backend/controllers/file.controller.js` `backend/test/product.controller.test.js` `frontend/src/pages/*.test.js` |
| 具体修改点 | 1. 在重提弹窗新增检测报告、资质文件上传控件。 2. 前端先上传文件拿到新 IPFS 哈希，再提交重提请求。 3. 后端 `resubmitProduct` 支持接收新的 `ipfsHash` 和 `qualificationHash`。 4. 保留旧的手填哈希作为兼容备用，但默认隐藏或降级为高级选项。 |
| 数据库/模型是否需要变化 | 否 |
| 合约是否需要变化 | 否 |
| 前端是否需要变化 | 是，本批以前端为主 |
| 后端是否需要变化 | 是，主要是兼容新的提交流程 |
| AI 服务是否需要变化 | 否 |
| 测试方案 | 1. 前端新增重提页上传新文件测试。 2. 后端新增带新哈希重提的测试 |
| 验收标准 | 卖家可以直接重新上传文件并成功重提；原重提逻辑不被破坏 |
| 风险点 | 要避免把新增上传能力写成与新增商品完全重复的一套逻辑，尽量复用已有文件服务 |
| 回滚方式 | 回滚前端重提上传入口与后端兼容逻辑；旧的手填哈希方式仍然可用 |

### 第七批执行建议

- 本批不要重新设计整套商品编辑页，只解决“重提时换文件”的关键痛点。

---

## 第八批：监管后台高级检索

| 项 | 内容 |
| --- | --- |
| 批次名称 | 第八批：监管后台高级检索 |
| 目标 | 把监管端从展示面板升级为可检索、可筛查、可定位问题的工作台 |
| 涉及文件 | `backend/routes/audit.routes.js` `backend/controllers/audit.controller.js` `backend/controllers/product.controller.js` `frontend/src/components/Dashboard.js` `frontend/src/pages/Home.js` `frontend/src/services/audit-log.service.js` `frontend/src/services/product.service.js` `backend/test/audit.controller.test.js` `frontend/src/components/Dashboard.test.js` |
| 具体修改点 | 1. 扩展审计日志查询，支持时间范围、关键词、目标 ID、操作者、动作、结果、分页。 2. 扩展投诉与待审核商品的查询参数。 3. 在监管端增加筛选表单、分页、重置、导出。 4. 将首页中的审计日志中心从静态最近 50 条扩展为可查询视图。 |
| 数据库/模型是否需要变化 | 否，优先复用现有审计表；如性能不足，再评估索引和分页优化 |
| 合约是否需要变化 | 否 |
| 前端是否需要变化 | 是 |
| 后端是否需要变化 | 是 |
| AI 服务是否需要变化 | 否 |
| 测试方案 | 1. 后端新增筛选参数测试。 2. 前端新增筛选条件交互测试 |
| 验收标准 | 监管员能按时间、动作、对象、结果等条件检索日志与问题对象；导出功能继续可用 |
| 风险点 | 查询接口容易无限膨胀，因此本批应以审计日志和投诉/待审核商品为主，不一次性做全站搜索 |
| 回滚方式 | 回滚新增查询参数和前端筛选 UI；原看板仍能显示默认数据 |

### 第八批执行建议

- 本批聚焦“监管端可检索”，不同时做统计图重构。

---

## 第九批：管理员/监管员初始化与用户管理

| 项 | 内容 |
| --- | --- |
| 批次名称 | 第九批：管理员/监管员初始化与用户管理 |
| 目标 | 补齐管理账号初始化、用户治理和后台运维能力 |
| 涉及文件 | `backend/controllers/auth.controller.js` `backend/routes/auth.routes.js` `backend/models/user.model.js` `backend/config/runtime-schema.js` `backend/test/auth.controller.test.js` `backend/server.js` `package.json` `frontend/src/pages/Home.js` `frontend/src/services/auth.service.js` `blockchain/migrations/1_deploy.js` |
| 具体修改点 | 1. 新增初始化脚本或 seed 脚本，用于创建首个管理员/监管员账号。 2. 新增用户管理接口，支持用户列表、角色筛选、冻结/解冻。 3. 在监管/管理首页加入用户管理入口。 4. 明确管理员与监管员职责边界。 5. 如需要，增加用户表的冻结原因、冻结时间字段。 |
| 数据库/模型是否需要变化 | 建议是。最小可增加 `frozenReason`、`frozenAt`；如不加字段，也至少要补管理接口和脚本 |
| 合约是否需要变化 | 一般不需要。若要让管理员地址初始化更清晰，可补部署文档或脚本，但不建议本批改合约 |
| 前端是否需要变化 | 是，需要至少提供最小用户管理页或面板 |
| 后端是否需要变化 | 是 |
| AI 服务是否需要变化 | 否 |
| 测试方案 | 1. 后端新增初始化脚本或用户管理接口测试。 2. 前端新增用户列表/操作测试 |
| 验收标准 | 新环境可规范初始化管理账号；管理员能查看并治理用户；不会影响现有买卖家注册登录流程 |
| 风险点 | 权限边界必须清晰，避免管理员接口被普通角色访问 |
| 回滚方式 | 回滚新增管理接口和前端入口；初始化脚本可停止使用；新增字段可保留不启用 |

### 第九批执行建议

- 推荐把“首个管理员创建”做成显式脚本，不要继续依赖数据库手工改表。

---

## 第十批：中文乱码与用户可见文案体验优化

| 项 | 内容 |
| --- | --- |
| 批次名称 | 第十批：中文乱码与用户可见文案体验优化 |
| 目标 | 统一解决乱码、文案不一致、提示语不专业的问题，提升演示与交互体验 |
| 涉及文件 | `frontend/src/pages/*.js` `frontend/src/components/*.js` `frontend/src/pages/*.test.js` `frontend/src/components/*.test.js` `frontend/src/App.css` `frontend/src/index.css` `frontend/public/index.html` |
| 具体修改点 | 1. 统一前端源码编码为 UTF-8。 2. 修复页面、按钮、提示框、状态标签的乱码。 3. 统一术语，例如“待审核”“已召回”“售后申请”“投诉裁决”等。 4. 清理混杂的技术性英文提示，改为用户可理解文案。 5. 同步更新依赖文案的测试用例。 |
| 数据库/模型是否需要变化 | 否 |
| 合约是否需要变化 | 否 |
| 前端是否需要变化 | 是，本批几乎全部集中在前端 |
| 后端是否需要变化 | 一般不需要，除非接口返回文案也需一并统一 |
| AI 服务是否需要变化 | 否 |
| 测试方案 | 1. 更新所有依赖旧乱码文本的前端测试。 2. 补充关键用户路径的文案展示测试。 3. 回归前端全量测试 |
| 验收标准 | 前端无明显乱码；核心流程提示语统一；测试稳定通过 |
| 风险点 | 文案集中修改会导致大量测试同步变化，必须安排在业务路径稳定之后处理 |
| 回滚方式 | 回滚前端文案和测试文本；本批无结构性回滚成本 |

### 第十批执行建议

- 本批不做业务逻辑重构，聚焦编码、可读性和用户体验。

---

## 5. 每批通用执行规范

每一批都应遵守以下固定流程：

1. 先阅读本批涉及文件并确认现状。
2. 只修改本批指定范围，不提前实施下一批内容。
3. 先补测试，再改实现，或至少保证实现完成后补齐测试。
4. 执行与本批相关的最小测试集，再执行全量测试。
5. 提交实施总结，包含改动点、测试结果、已知风险、是否可回滚。

建议每批执行时的标准输出模板：

- 本批目标
- 实际修改文件
- 新增或变更的接口
- 新增或变更的模型/字段
- 测试执行结果
- 验收结论
- 剩余风险

---

## 6. 本文档对应的当前代码依据

本实施计划主要基于以下代码现状整理：

- 前端入口与页面：`frontend/src/App.js` `frontend/src/pages/*.js` `frontend/src/components/*.js`
- 前端服务层：`frontend/src/services/*.js`
- 后端入口与路由：`backend/server.js` `backend/routes/*.js`
- 后端控制器与服务：`backend/controllers/*.js` `backend/services/*.js`
- 数据模型：`backend/models/*.js`
- 运行时配置与环境：`backend/config/*.js` `.env.example` `backend/.env.example` `frontend/.env.example`
- AI 服务：`ai_service/app.py` `ai_service/model_utils.py` `ai_service/train_model.py`
- 合约与部署：`blockchain/contracts/ProductRegulation.sol` `blockchain/migrations/1_deploy.js` `blockchain/truffle-config.js`
- 测试：`backend/test/*.test.js` `frontend/src/pages/*.test.js` `frontend/src/components/*.test.js` `blockchain/test/product_regulation.test.js`

---

## 7. 最终建议

本项目当前已经具备较完整的“电子产品交易监管平台”雏形，但其核心短板不在于页面数量不足，而在于以下三类能力尚未闭环：

- 业务可靠性：AI 降级、库存并发、补偿与对账
- 交易闭环：支付、退款、召回通知、售后与投诉规则
- 运维与监管可用性：高级检索、用户治理、文案体验

因此，后续不要再进行无批次边界的同步大改，而应严格按本文档十个批次推进。建议从第一批开始，逐批实施、逐批测试、逐批验收。

