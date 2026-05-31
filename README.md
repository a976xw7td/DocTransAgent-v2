<p align="center">
  <img src="https://img.shields.io/badge/Builder-头号Builder全球挑战赛-8B5CF6?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/GMI-Cloud-6366F1?style=for-the-badge" />
</p>

<h1 align="center">DocTransAgent</h1>

<p align="center">
  <strong>AI 驱动的海外文档翻译与知识库智能体</strong><br/>
  为头号Builder全球挑战赛 北京站打造
</p>

---

## 系统架构

```
┌─────────────────────────────────────────────────────┐
│              Next.js :3000 (前端)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ 文档上传  │ │ 翻译管理  │ │ 知识库           │   │
│  │ 双语审校  │ │ 语义搜索  │ │ RAG问答 / 术语表 │   │
│  └────┬─────┘ └────┬─────┘ └───────┬──────────┘   │
│       │            │              │                │
│       └────────────┼──────────────┘                │
│                    │ 代理 /api/*                   │
└────────────────────┼──────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────┐
│           FastAPI :8000 (后端)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ 文档解析  │ │ 翻译引擎  │ │ RAG 引擎         │   │
│  │          │ │          │ │ (ChromaDB)       │   │
│  └──────────┘ └──────────┘ └──────────────────┘   │
│                     │                              │
│  ┌──────────────────┴──────────────────────────┐  │
│  │        GMI Cloud 推理引擎                    │  │
│  │  ┌────────┐ ┌────────┐ ┌──────┐ ┌────────┐  │  │
│  │  │Gemini  │ │DeepSeek│ │GLM-4 │ │ Qwen3  │  │  │
│  │  │2.5Flash│ │  V3    │ │解析   │ │Embed   │  │  │
│  │  └────────┘ └────────┘ └──────┘ └────────┘  │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## 核心功能

| 功能 | 说明 |
|------|------|
| 多格式文档解析 | 支持 PDF、DOCX、Markdown、TXT，保留章节层级结构 |
| 术语表驱动翻译 | 基于 Gemini 2.5 Flash 的企业级术语一致性引擎 |
| 跨语言语义搜索 | 中文查询匹配英文文档，反之亦然（Qwen3-Embedding） |
| RAG 引用式问答 | 基于 DeepSeek V3 的溯源回答，支持流式 SSE |
| 术语自动提取 | GLM-4 驱动的领域术语自动发现 |
| ROI 仪表盘 | 实时展示相比人工翻译的成本节省 |

## 技术栈

| 层级 | 技术 |
|------|------|
| LLM 网关 | GMI Cloud 推理引擎（四模型路由） |
| 后端 | Python 3.10 + FastAPI |
| 向量数据库 | ChromaDB（嵌入式） |
| 元数据存储 | SQLite |
| 前端 | Next.js 16 + React 19 + Tailwind CSS |
| 翻译模型 | Gemini 2.5 Flash（经由 GMI Cloud） |
| 问答模型 | DeepSeek V3（经由 GMI Cloud） |
| 结构解析 | GLM-4（经由 GMI Cloud） |
| 向量嵌入 | Qwen3-Embedding-8B（经由 GMI Cloud） |

## 快速开始

```bash
# 1. 配置环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env，填入你的 GMI_API_KEY

# 2. 测试 GMI Cloud 连接
python scripts/test_gmi_connection.py

# 3. 导入演示数据
python scripts/seed_demo_data.py

# 4. 一键启动
./run.sh
```

- 前端地址：http://localhost:3000
- API 文档：http://localhost:8000/docs

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/documents/upload` | 上传文档 |
| `GET` | `/api/documents` | 文档列表 |
| `POST` | `/api/translate/{id}` | 发起翻译 |
| `GET` | `/api/translate/{id}/progress` | 翻译进度 |
| `POST` | `/api/kb/index/{id}` | 索引到知识库 |
| `GET` | `/api/kb/search?q=...` | 跨语言搜索 |
| `POST` | `/api/qa/ask` | RAG 问答 |
| `POST` | `/api/qa/ask/stream` | 流式 RAG 问答 |
| `GET/POST` | `/api/glossary` | 术语表管理 |
| `POST` | `/api/glossary/auto-extract` | 自动提取术语 |
| `GET` | `/api/dashboard/stats` | 仪表盘统计 |

## 项目结构

```
backend/          FastAPI 后端（20 个 .py 文件）
  routes/         6 个 API 路由模块
  services/       7 个业务逻辑模块
  test_docs/      3 份中文演示文档
frontend/         Next.js 16 前端（12 个 .ts/.tsx 文件）
  components/     侧边栏、GMI状态栏、徽章组件
  hooks/          流式问答、翻译进度等自定义 Hook
  app/            6 个页面（仪表盘、上传、翻译、知识库、问答、术语表）
scripts/          数据导入与连接测试脚本
PITCH.md          演示脚本与评审要点
```
