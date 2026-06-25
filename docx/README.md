# JCC Ticket Cloudflare Lite 文档目录

本目录用于沉淀从 `JCC Table` Excel v9 版转换为 Cloudflare 轻量 Web 项目的设计文档。

项目目标：保留 v9 版成熟的存票管理能力，去掉 Excel/WPS 文件协作限制，做成可部署到 Cloudflare、可多人访问、可永久存储数据的轻量应用。

## 文档清单

- `01_project_requirements.md`：项目需求与范围
- `02_data_model_design.md`：数据模型设计
- `03_page_interaction_design.md`：页面与交互设计
- `04_api_design.md`：接口设计
- `05_cloudflare_deployment_design.md`：Cloudflare 部署与存储方案
- `06_migration_plan.md`：从 Excel v9 迁移计划
- `07_mvp_task_breakdown.md`：MVP 实施拆解
- `08_formal_project_conversion_plan.md`：正式项目转换实施方案
- `09_database_and_api_implementation.md`：数据库与接口实现方案
- `10_cloudflare_deployment_runbook.md`：Cloudflare 部署操作说明
- `11_progress_checklist.md`：开发进度计划清单

## 推荐阅读顺序

1. 先看 `01_project_requirements.md`，确认这个轻量项目要做什么、不做什么。
2. 再看 `02_data_model_design.md`，确认数据如何永久保存。
3. 然后看 `03_page_interaction_design.md`，理解用户实际怎么操作。
4. 最后看部署、迁移和任务拆解。
5. 准备正式开发时，重点看 `08` 到 `11`，它们对应项目结构、数据库接口、部署操作和进度验收。
