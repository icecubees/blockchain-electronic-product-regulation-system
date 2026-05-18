# 基于区块链的电子产品交易平台监管系统的设计与实现

## 项目简介

本系统面向毕业设计课题“基于区块链的电子产品交易平台监管系统的设计与实现”，实现了一个围绕电子产品交易、审核、追溯与监管的原型系统。系统将传统电商业务流程与区块链存证、监管审核、AI 辅助预审相结合，用于展示电子产品交易平台在合规监管场景下的设计思路与实现方案。

系统覆盖买家、卖家、监管方三类角色，支持卖家入驻审核、商品发布与审核、交易下单、收货评价、投诉处理、售后记录、召回通知、黑名单同步与审计日志留痕等业务流程。

## 项目目录

```text
frontend/      React 前端
backend/       Express + MySQL 后端服务
blockchain/    Solidity 合约与 Truffle 部署脚本
ai_service/    Flask AI 审核服务
```

## 项目说明

- 项目名称：基于区块链的电子产品交易平台监管系统
- 项目作者：Chen YiZhao
- 作者单位：暨南大学网络空间安全学院
- 开发语言：JavaScript、Python、Solidity、HTML、CSS
- 框架：React、Express、Flask、Sequelize、Truffle
- 核心技术：区块链智能合约、Web3.js、MySQL 数据持久化、AI 预审核、JWT 身份认证、二维码溯源、IPFS 文件存证

## 技术架构

### 前端

- React
- React Router
- Axios

### 后端

- Node.js
- Express
- Sequelize
- MySQL

### 区块链

- Solidity
- Truffle
- Ganache

### AI 预审核服务

- Flask
- scikit-learn
- PyMuPDF

## 主要功能

- 买家、卖家、监管方多角色登录与权限控制
- 卖家入驻申请与监管审批
- 电子产品信息提交、监管审核、上架管理
- AI 商品预审核与人工复核联动
- 订单创建、收货确认、评价、投诉处理
- 售后记录、召回通知、卖家黑名单管理
- 审计日志记录与系统健康检查
- 基于区块链的商品、订单与监管操作存证

## 运行环境建议

- Node.js 18 及以上
- npm 9 及以上
- MySQL 8.0 及以上
- Python 3.10 及以上
- Ganache Desktop 或 Ganache CLI

## 快速部署

下面是一套适合本地演示和答辩的快速启动流程。默认端口如下：

- 前端：`3000`
- 后端：`3001`
- AI 服务：`5000`
- Ganache：`7545`

### 1. 安装依赖

在仓库根目录执行：

```powershell
npm install
npm install --prefix backend
npm install --prefix frontend
```

说明：

- 根目录依赖主要用于 `truffle`
- 后端与前端依赖分别安装在各自目录

### 2. 创建 MySQL 数据库

先启动本机 MySQL，然后创建数据库：

```sql
CREATE DATABASE electronic_regulation_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

如果你使用命令行，可以执行：

```powershell
mysql -u root -p
```

进入 MySQL 后再执行上面的 `CREATE DATABASE` 语句。

### 3. 启动 Ganache 并部署智能合约

#### 方式一：Ganache Desktop

- 打开 Ganache Desktop
- 新建一个本地工作区
- 将 RPC 端口保持为 `7545`
- 确保本地区块链已启动

#### 方式二：Ganache CLI

如果你本机已安装 Ganache CLI，也可以直接启动：

```powershell
ganache --port 7545
```

Ganache 启动后，在仓库根目录执行合约部署：

```powershell
Set-Location .\blockchain
npx truffle migrate --reset --network development
Set-Location ..
```

部署成功后，后端可以直接读取 `blockchain/build/contracts/ProductRegulation.json` 中的最新合约地址。

### 4. 配置后端环境变量

复制环境变量模板：

```powershell
Copy-Item .\backend\.env.example .\backend\.env
Copy-Item .\frontend\.env.example .\frontend\.env
```

然后修改 `backend/.env`，至少确认下面这些字段：

```env
PORT=3001
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=你的MySQL密码
DB_NAME=electronic_regulation_db
JWT_SECRET=请替换成一段更长的随机字符串
GANACHE_URL=http://127.0.0.1:7545
CONTRACT_ADDRESS=
CHAIN_ADMIN_PRIVATE_KEY=
CHAIN_REGULATOR_PRIVATE_KEY=
CHAIN_MARKET_PRIVATE_KEY=
AI_ORACLE_PRIVATE_KEY=0x1111111111111111111111111111111111111111111111111111111111111111
PINATA_API_KEY=
PINATA_SECRET_API_KEY=
```

请注意：

- `CONTRACT_ADDRESS` 建议留空，系统会自动读取刚部署的最新合约地址
- 如果你把 `CONTRACT_ADDRESS` 留成示例里的占位值，后端会连不上合约
- 本地 Ganache 演示环境下，`CHAIN_ADMIN_PRIVATE_KEY`、`CHAIN_REGULATOR_PRIVATE_KEY`、`CHAIN_MARKET_PRIVATE_KEY` 可以留空，系统会回退到 Ganache 已解锁账户
- `AI_ORACLE_PRIVATE_KEY` 建议先使用上面的开发默认值，它与本项目本地部署脚本保持一致
- `PINATA_API_KEY` 和 `PINATA_SECRET_API_KEY` 不填也能启动系统，但 IPFS / Pinata 相关上传能力会受限

前端默认配置通常无需改动，`frontend/.env` 保持如下即可：

```env
REACT_APP_API_BASE_URL=http://localhost:3001
```

### 5. 启动 AI 审核服务

本项目仓库中已经包含训练好的模型文件 `ai_service/audit_model.pkl`，本地演示时无需重新训练模型。

第一次启动 AI 服务时，进入 `ai_service` 目录并安装 Python 依赖：

```powershell
Set-Location .\ai_service
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install flask pymupdf joblib scikit-learn
python .\app.py
```

启动成功后，AI 服务地址为：

```text
http://127.0.0.1:5000
```

补充说明：

- 如果暂时不启动 AI 服务，后端在商品提交时会自动降级为“人工复核”模式，系统仍可继续演示核心业务流程
- 如果模型文件缺失，再考虑执行 `python train_model.py` 重新训练

### 6. 启动后端服务

新开一个 PowerShell 窗口，执行：

```powershell
Set-Location .\backend
node .\server.js
```

后端默认运行在：

```text
http://localhost:3001
```

后端启动后会自动做这些事情：

- 连接 MySQL
- 同步基础表结构
- 执行数据库迁移
- 在本地开发模式下补齐运行时兼容字段

### 7. 初始化监管方账号

本项目的监管方账号需要手动初始化一次。进入 `backend` 目录后执行：

```powershell
node .\scripts\init-privileged-user.js --username=regulator --password=123456
```

你也可以改成自己的用户名和密码，例如：

```powershell
node .\scripts\init-privileged-user.js --username=admin_reg --password=YourPassword123
```

### 8. 导入答辩演示数据

如果希望每个演示入口都有可操作数据，在 MySQL、Ganache、合约和后端依赖准备好后，在仓库根目录执行：

```powershell
npm run seed:demo
```

脚本会补齐监管方、卖家、买家、待审核卖家、待审核商品、可购买商品、订单、投诉、售后、召回通知、黑名单和审计日志数据。脚本可重复执行，重复运行会刷新 `demo_` / `DEMO` 前缀的演示数据，不会批量清空现有业务数据。

推荐演示账号如下，密码均为 `123456`：

```text
监管方：demo_regulator
普通卖家：demo_seller
二手/翻新卖家：demo_refurb_seller
智能配件卖家：demo_accessory_seller
买家：demo_buyer
备用买家：demo_buyer_backup
企业买家：demo_enterprise_buyer
```

### 9. 启动前端

新开一个 PowerShell 窗口，执行：

```powershell
Set-Location .\frontend
npm start
```

前端默认地址：

```text
http://localhost:3000
```

## 推荐演示流程

系统启动后，建议按下面顺序进行演示：

1. 使用初始化好的监管方账号登录
2. 注册一个卖家账号和一个买家账号
3. 监管方审核通过卖家入驻申请
4. 卖家提交电子产品信息与检测材料
5. 监管方查看 AI 预审核结果并完成人工审核
6. 买家下单、确认收货、评价
7. 演示投诉处理、售后记录或召回通知功能

## 常见问题

### 1. 后端提示缺少合约地址

请检查两件事：

- Ganache 是否已经启动
- 是否已经执行过 `npx truffle migrate --reset --network development`

同时确认 `backend/.env` 中的 `CONTRACT_ADDRESS` 不是占位字符串。最简单的处理方式是直接留空。

### 2. 后端连接数据库失败

请检查：

- MySQL 服务是否启动
- `backend/.env` 中的 `DB_HOST`、`DB_USER`、`DB_PASSWORD`、`DB_NAME` 是否填写正确
- 数据库 `electronic_regulation_db` 是否已经创建

### 3. 前端打开后接口报错

请检查：

- 后端是否已经运行在 `http://localhost:3001`
- `frontend/.env` 中的 `REACT_APP_API_BASE_URL` 是否正确

### 4. AI 服务启动失败

请优先检查：

- 是否已安装 `flask`、`pymupdf`、`joblib`、`scikit-learn`
- `ai_service/audit_model.pkl` 是否存在

如果 AI 服务暂时不可用，系统会将商品审核流程降级为人工复核，不影响核心业务演示。

### 5. Pinata 未配置是否影响运行

不影响系统基础启动，但会影响 IPFS / Pinata 相关文件上传功能。用于毕设本地答辩演示时，如果不重点展示链下文件存储，可以先不配置。

## 测试命令

在仓库根目录可执行：

```powershell
npm run test
```

也可以分别执行：

```powershell
npm run test:backend
npm run test:frontend
npm run test:blockchain
```
