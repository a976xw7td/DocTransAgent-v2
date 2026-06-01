<p align="center">
  <img src="https://img.shields.io/badge/Builder-头号Builder全球挑战赛-8B5CF6?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Python-3.14-3776AB?style=for-the-badge&logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-0.109+-009688?style=for-the-badge&logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/ChromaDB-Vector_DB-FF6B6B?style=for-the-badge" />
</p>

<h1 align="center">DocTransAgent</h1>

<p align="center">
  <strong>企业级多语言文档智能翻译与知识管理平台</strong><br/>
  基于 RAG + GraphRAG 架构，为出海企业提供一站式文档解决方案
</p>

<p align="center">
  <a href="#-核心功能">核心功能</a> •
  <a href="#-系统架构">系统架构</a> •
  <a href="#-技术亮点">技术亮点</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="#-api-接口">API 接口</a>
</p>

---

## 项目简介

DocTransAgent 是一个**企业级多语言文档智能翻译与知识管理平台**，基于 RAG（检索增强生成）架构，集成 GraphRAG 知识图谱技术，为出海企业提供从文档翻译、知识构建到智能问答的一站式解决方案。

**应用场景：**
- 出海企业文档翻译（产品文档、合规文件、营销材料）
- 跨语言知识库构建与检索
- 技术文档双语审校
- 基于文档的智能问答系统
- Obsidian 个人知识库向量化

---

## 核心功能

### 1. 智能文档翻译

| 特性 | 说明 |
|------|------|
| 多格式支持 | PDF、DOCX、Markdown、TXT |
| 10 种语言互译 | 中/英/日/韩/法/德/西/葡/阿拉伯/俄 |
| 自动语言检测 | 智能识别源语言 |
| 语义分块翻译 | 保持文档结构完整性 |
| 10 路并发翻译 | 速度提升 10 倍 |
| 翻译记忆缓存 | 相同内容不重复调用 |
| 术语表注入 | 确保专业术语一致性 |

### 2. 双语对照审校

- 左右分屏显示原文和译文
- 按章节导航，快速定位
- 术语高亮显示
- 全文视图 / 分节视图切换
- 导出双语对照文档（PDF/DOCX/Markdown）

### 3. RAG 智能问答

- 基于文档内容的精准问答
- 语义检索 + 关键词检索混合策略
- 引用溯源：答案标注 `[Source N]` 来源
- 流式响应（SSE），实时输出
- 多轮对话历史管理

### 4. 知识库管理

- 文档索引：切块 → 向量化 → ChromaDB
- 向量检索：语义相似度匹配
- 混合检索：语义失败自动降级关键词
- 索引统计：文档数、chunk 数、向量维度

### 5. 术语表管理

- 手动添加专业术语对照
- AI 自动提取文档术语
- 翻译时自动注入
- 按项目分组管理

### 6. 知识图谱（GraphRAG）

- Obsidian Vault 导入（wikilinks/tags/frontmatter）
- 文档自动入图
- 图谱可视化（Force Graph）
- 图谱增强问答

### 7. 仪表盘统计

- 文档/翻译/索引数量统计
- API 调用量、Token 消耗、成本估算
- 模型状态监控
- 最近活动记录

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js 16)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│
│  │  Upload   │ │Translate │ │    QA    │ │  Graph   │ │Glossary││
│  └─────┬────┘ └─────┬────┘ └─────┬────┘ └─────┬────┘ └───┬────┘│
│        └─────────────┴────────────┴────────────┴───────────┘    │
│                             │ /api/*                             │
└─────────────────────────────┼────────────────────────────────────┘
                              │
┌─────────────────────────────┼────────────────────────────────────┐
│                      Backend (FastAPI)                            │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                      Routes Layer                            │ │
│  │   documents / translation / qa / kb / graph / glossary      │ │
│  └───────────────────────────────┬─────────────────────────────┘ │
│  ┌───────────────────────────────┼─────────────────────────────┐ │
│  │                     Services Layer                           │ │
│  │   parser / translator / retriever / qa_engine / graph       │ │
│  └───────────────────────────────┬─────────────────────────────┘ │
│  ┌───────────────────────────────┼─────────────────────────────┐ │
│  │                      Data Layer                              │ │
│  │      SQLAlchemy (SQLite)      │     ChromaDB (Vectors)      │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                      AI Layer (GMI Client)                   │ │
│  │       火山方舟 (Chat)         │     硅基流动 (Embedding)     │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Next.js 16 + React 19 | 服务端渲染 + App Router |
| UI 样式 | Tailwind CSS 4 | 原子化 CSS |
| 后端框架 | FastAPI | 异步高性能 API |
| 数据库 | SQLite + SQLAlchemy | 轻量级 ORM |
| 向量数据库 | ChromaDB | 嵌入式向量存储 |
| 翻译模型 | doubao-1-5-lite-32k | 火山方舟豆包模型 |
| Embedding | BAAI/bge-m3 | 硅基流动多语言嵌入 |
| 国际化 | react-i18next | 中英文切换 |
| 图谱可视化 | D3 Force Graph | 交互式知识图谱 |

---

## 技术亮点

### 1. 优雅降级策略

```python
# 检索降级：语义检索 → 关键词检索
async def search(query, top_k=10):
    collection = get_chroma_collection()
    if collection is None:
        return _keyword_search(query, top_k=top_k)
    
    try:
        query_vec = await embed_query(query)
    except Exception:
        return _keyword_search(query, top_k=top_k)
    
    results = collection.query(query_embeddings=[query_vec], n_results=top_k)
    
    if not results["ids"][0]:
        return _keyword_search(query, top_k=top_k)
```

### 2. 并发翻译引擎

```python
async def translate_document(doc_id, sections, source_lang, target_lang, glossary):
    chunked = chunk_sections_for_translation(sections)
    sem = asyncio.Semaphore(10)  # 10 并发
    
    # 标题并发翻译
    heading_tasks = [translate_heading(h) for h in unique_headings]
    heading_results = await asyncio.gather(*heading_tasks)
    
    # 内容并发翻译
    tasks = [translate_one(i, item) for i, item in enumerate(chunked)]
    results = await asyncio.gather(*tasks)
```

### 3. 幂等导入设计

```python
# Obsidian Vault 导入支持幂等
def import_obsidian_vault(db, vault_path, source_lang, target_lang):
    # 清除旧的边
    _cleanup_previous_edges(db, vault_path)
    
    # 使用 stable_key 去重
    existing = db.query(GraphNode).filter(GraphNode.stable_key == stable_key).first()
    if existing:
        existing.label = label
        existing.updated_at = now
    else:
        db.add(GraphNode(...))
```

### 4. 多语言 CJK 分词

```python
def _tokenize_cjk(text):
    """中文模糊匹配：单字 + 双字 + 全文"""
    tokens = []
    cjk_run = "".join(ch for ch in text if "\u4e00" <= ch <= "\u9fff")
    if len(cjk_run) >= 1:
        tokens.extend(ch for ch in cjk_run)  # 单字
    if len(cjk_run) >= 2:
        for i in range(len(cjk_run) - 1):
            tokens.append(cjk_run[i:i+2])  # 双字
    tokens.append(cjk_run)  # 全文
    return tokens
```

### 5. 流式响应（SSE）

```python
@router.post("/ask/stream")
async def ask_question_stream(req: QuestionRequest):
    async def event_stream():
        async for token in ask_stream(req.question, ...):
            yield f"data: {json.dumps({'token': token})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"
    
    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

---

## 数据库设计

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `documents` | 文档记录 | id, filename, status, parsed_content, translated_content |
| `translation_jobs` | 翻译任务 | doc_id, model_used, tokens_input, latency_ms |
| `glossary_entries` | 术语表 | source_term, target_term, category |
| `translation_memory` | 翻译缓存 | source_hash, source_text, translated_text |
| `usage_logs` | 使用日志 | model_name, tokens_input, estimated_cost_usd |
| `graph_nodes` | 图节点 | node_type, stable_key, label, doc_id |
| `graph_edges` | 图边 | source_id, target_id, relation |
| `source_imports` | 导入记录 | source_type, source_path, status |

---

## 快速开始

### 环境要求

- Python 3.14（推荐）
- Node.js 18+
- 火山方舟 API Key
- 硅基流动 API Key（可选，用于 Embedding）

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/DocTransAgent.git
cd DocTransAgent

# 2. 配置后端环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env，填入 API Key

# 3. 安装后端依赖
cd backend
py -3.14 -m pip install -r requirements.txt

# 4. 安装前端依赖
cd ../frontend
npm install

# 5. 启动后端（使用 Python 3.14）
cd ../backend
py -3.14 -m uvicorn app:app --host 127.0.0.1 --port 8001

# 6. 启动前端
cd ../frontend
npm run dev
```

### 访问地址

- 前端：http://localhost:3001
- API 文档：http://localhost:8001/docs
- 健康检查：http://localhost:8001/api/health

---

## API 接口

### 文档管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/documents/upload` | 上传文档 |
| `GET` | `/api/documents` | 文档列表 |
| `GET` | `/api/documents/{id}` | 文档详情 |
| `DELETE` | `/api/documents/{id}` | 删除文档 |
| `DELETE` | `/api/documents/clear` | 清空所有文档 |

### 翻译

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/translate/{id}` | 发起翻译 |
| `POST` | `/api/translate/batch` | 批量翻译 |
| `GET` | `/api/translate/{id}/progress` | 翻译进度 |

### 知识库

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/kb/index/{id}` | 索引文档 |
| `POST` | `/api/kb/index/batch` | 批量索引 |
| `GET` | `/api/kb/search?q=...` | 语义搜索 |
| `GET` | `/api/kb/stats` | 索引统计 |

### 智能问答

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/qa/ask` | RAG 问答 |
| `POST` | `/api/qa/ask/stream` | 流式问答 |
| `DELETE` | `/api/qa/session/{id}` | 清除会话 |

### 术语表

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/glossary` | 术语列表 |
| `POST` | `/api/glossary` | 添加术语 |
| `DELETE` | `/api/glossary/{id}` | 删除术语 |
| `POST` | `/api/glossary/auto-extract` | AI 提取术语 |

### 知识图谱

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/graph/stats` | 图谱统计 |
| `GET` | `/api/graph/nodes` | 节点列表 |
| `GET` | `/api/graph/nodes/{id}` | 节点详情 |
| `GET` | `/api/graph/neighborhood/{id}` | 邻居节点 |
| `POST` | `/api/sources/obsidian/import` | 导入 Obsidian |

### 导出

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/export/{id}/bilingual` | 双语对照 |
| `GET` | `/api/export/{id}/pdf` | 导出 PDF |
| `GET` | `/api/export/{id}/docx` | 导出 DOCX |

---

## 项目结构

```
DocTransAgent/
├── backend/                        # FastAPI 后端
│   ├── app.py                      # 主入口
│   ├── config.py                   # 配置管理
│   ├── database.py                 # 数据库初始化
│   ├── models.py                   # 数据模型（8 个表）
│   ├── gmi_client.py               # AI 模型客户端
│   ├── requirements.txt            # Python 依赖
│   ├── .env                        # 环境变量
│   ├── routes/                     # API 路由层
│   │   ├── documents.py            # 文档 CRUD
│   │   ├── translation.py          # 翻译管理
│   │   ├── qa.py                   # 智能问答
│   │   ├── knowledge_base.py       # 知识库
│   │   ├── glossary.py             # 术语表
│   │   ├── graph.py                # 知识图谱
│   │   ├── dashboard.py            # 仪表盘
│   │   ├── export.py               # 导出功能
│   │   └── obsidian.py             # Obsidian 导入
│   ├── services/                   # 业务逻辑层
│   │   ├── parser.py               # 文档解析
│   │   ├── translator.py           # 翻译编排
│   │   ├── chunker.py              # 文本分块
│   │   ├── embedder.py             # 向量嵌入
│   │   ├── retriever.py            # 检索器
│   │   ├── qa_engine.py            # 问答引擎
│   │   ├── glossary_service.py     # 术语服务
│   │   ├── graph_retriever.py      # 图谱检索
│   │   ├── markdown_parser.py      # Markdown 解析
│   │   ├── obsidian_importer.py    # Obsidian 导入
│   │   ├── source_identity.py      # 文档身份
│   │   └── retrieval_diagnostics.py # 检索诊断
│   ├── static/uploads/             # 上传文件
│   ├── data/                       # SQLite + ChromaDB
│   └── tests/                      # 测试文件
│
├── frontend/                       # Next.js 16 前端
│   ├── src/
│   │   ├── app/                    # 页面路由
│   │   │   ├── page.tsx            # 首页/仪表盘
│   │   │   ├── upload/             # 文档上传
│   │   │   ├── translate/[id]/     # 翻译审校
│   │   │   ├── qa/                 # 智能问答
│   │   │   ├── kb/                 # 知识库
│   │   │   ├── glossary/           # 术语表
│   │   │   ├── graph/              # 知识图谱
│   │   │   └── obsidian/           # Obsidian 导入
│   │   ├── components/             # 共享组件
│   │   ├── hooks/                  # 自定义 Hooks
│   │   └── lib/                    # API 客户端 + i18n
│   ├── next.config.ts              # 代理配置
│   └── package.json
│
├── demo-vault/                     # Obsidian 示例库
├── scripts/                        # 工具脚本
├── CLAUDE.md                       # 项目指南
└── README.md
```

---

## 项目数据

| 指标 | 数值 |
|------|------|
| 代码量 | ~8000 行 |
| API 接口 | 25+ 个 |
| 数据库表 | 8 个 |
| 测试文件 | 11 个 |
| 支持语言 | 10 种 |
| 并发翻译 | 10 路 |
| 向量维度 | 1024 |

---

## 面试要点

### Q: 为什么选择 RAG 架构？
> RAG 解决了 LLM 的知识时效性问题和幻觉问题。通过检索相关文档作为上下文，让模型基于事实回答，同时支持引用溯源。

### Q: 如何处理 Embedding 不可用的情况？
> 系统实现了优雅降级策略：语义检索 → 关键词检索。当 Embedding API 不可用时，自动切换到基于分词的关键词检索，保证系统可用性。

### Q: 如何保证翻译一致性？
> 通过术语表注入机制，在翻译 prompt 中强制使用指定的术语翻译，同时支持 AI 自动提取专业术语。

### Q: 如何处理大文档翻译？
> 语义分块 + 并发翻译。将文档按段落分块，10 个 chunk 同时翻译，翻译记忆缓存避免重复调用，进度实时追踪。

### Q: GraphRAG 的作用是什么？
> 传统 RAG 只能检索文本片段，GraphRAG 通过知识图谱扩展上下文。当用户提问时，除了检索相关文本，还会查询图谱中的关联节点，提供更完整的答案。

---

## 许可证

MIT License

---

<p align="center">
  Made with ❤️ for 出海企业
</p>
