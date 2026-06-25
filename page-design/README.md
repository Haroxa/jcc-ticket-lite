# 页面设计目录

本目录用于设计 `JCC Ticket Cloudflare Lite` 的页面布局、信息层级和交互细节。

目标是把 Excel v9 的成熟操作体验转换成浏览器页面，同时保持项目轻量、清晰、容易实现。

## 文件清单

- `00_design_principles.md`：整体设计原则
- `01_app_shell.md`：应用外壳、导航和全局布局
- `02_login_page.md`：登录页
- `03_dashboard_page.md`：首页汇总
- `04_quick_entry_page.md`：快速录入页
- `05_people_page.md`：存票人管理页
- `06_records_page.md`：存取记录页
- `07_person_history_page.md`：个人历史页
- `08_calculator_page.md`：快速录入内的计算工具模块
- `09_import_export_page.md`：导入导出页
- `10_settings_page.md`：系统信息与维护页
- `11_mobile_layout.md`：移动端布局策略
- `12_responsive_device_design.md`：电脑、平板、手机多端适配设计
- `13_prototype_review.md`：当前页面原型审查评估

## 推荐设计顺序

1. 先确定 `01_app_shell.md`，让导航和页面容器稳定。
2. 再做 `03_dashboard_page.md` 和 `04_quick_entry_page.md`，这是最高频路径。
3. 然后补齐记录、个人历史、导入导出和设置。
4. 实现页面时按 `12_responsive_device_design.md` 校验电脑、平板、手机三类设备。
