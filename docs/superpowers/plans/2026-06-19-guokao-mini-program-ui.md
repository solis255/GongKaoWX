# 国考刷题微信小程序界面实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `design/screens/` 中九张高保真设计稿实现为可运行的原生微信小程序，并接通本地 JSON 题库、答题、解析、错题和统计流程。

**Architecture:** 使用原生 WXML、WXSS 和 CommonJS。纯数据逻辑放在 `services/`，通过 Node 内置测试验证；页面只负责展示和调用服务。题库继续以项目根目录 `questions/` 为单一数据源。

**Tech Stack:** 微信小程序原生框架、JavaScript、WXML、WXSS、Node.js 内置测试运行器。

---

## 文件结构

- Create: `app.js`, `app.json`, `app.wxss`, `project.config.json`, `sitemap.json`
- Create: `services/question-bank.js`, `services/practice-session.js`, `services/storage.js`
- Create: `tests/question-bank.test.mjs`, `tests/practice-session.test.mjs`
- Create: `components/app-header/*`, `components/progress-bar/*`, `components/bottom-nav/*`
- Create: `pages/home/*`, `pages/bank/*`, `pages/practice-setup/*`, `pages/question/*`, `pages/analysis/*`, `pages/result/*`, `pages/wrong/*`, `pages/stats/*`, `pages/profile/*`

### Task 1: 建立题库与练习会话逻辑

- [ ] **Step 1: 写失败测试**

测试模块映射、抽题数量、作答判定、结果汇总和非法题目过滤。

- [ ] **Step 2: 验证测试因模块不存在而失败**

Run: `node --test tests/question-bank.test.mjs tests/practice-session.test.mjs`
Expected: FAIL，提示找不到 `services/question-bank.js` 或 `services/practice-session.js`。

- [ ] **Step 3: 实现最小数据层**

`question-bank.js` 暴露 `listModules()`、`loadBank(moduleKey)`、`pickQuestions(moduleKey, count, random)`；`practice-session.js` 暴露 `createSession()`、`selectAnswer()`、`submitAnswer()`、`moveNext()`、`summarizeSession()`。

- [ ] **Step 4: 运行测试并确认通过**

Run: `node --test tests/question-bank.test.mjs tests/practice-session.test.mjs`
Expected: PASS。

### Task 2: 建立小程序骨架与共享视觉组件

- [ ] **Step 1: 创建应用配置**

在 `app.json` 注册九个页面，启用自定义导航栏；在 `project.config.json` 设置 `miniprogramRoot` 为项目根目录。

- [ ] **Step 2: 创建全局设计令牌**

在 `app.wxss` 定义暖白背景、薄荷绿/天空蓝、正文色、圆角、阴影、页面边距和按钮样式。

- [ ] **Step 3: 创建共享组件**

实现顶部栏、进度条和底部导航，所有可见控件均有点击事件或明确的禁用状态。

### Task 3: 实现一级页面

- [ ] **Step 1: 实现首页**

呈现今日目标、六科进度、继续刷题和错题提醒，并接通题库、答题和错题跳转。

- [ ] **Step 2: 实现题库页**

呈现六模块与推荐练习，点击模块进入练习设置。

- [ ] **Step 3: 实现错题本**

支持模块筛选和重新练习入口，使用本地存储读取错题 ID。

- [ ] **Step 4: 实现个人中心与学习统计**

呈现学习目标、练习记录、收藏、累计题量、正确率和模块能力。

### Task 4: 实现完整答题闭环

- [ ] **Step 1: 实现练习设置页**

支持题量、顺序、只练未做题和自动加入错题本设置。

- [ ] **Step 2: 实现答题页**

支持 A-D 选项、收藏、提交按钮禁用态和答题进度。

- [ ] **Step 3: 实现解析页**

显示正确/错误状态、正确答案、解析、知识点和下一题。

- [ ] **Step 4: 实现结果页**

显示正确率、用时、连续正确数、错题回顾和再练一组。

### Task 5: 验证与视觉 QA

- [ ] **Step 1: 运行全部自动测试**

Run: `node --test tests/*.test.mjs`
Expected: 全部 PASS。

- [ ] **Step 2: 校验题库**

Run: `node scripts/validate-question-banks.mjs`
Expected: 六套题库、360 题全部 valid。

- [ ] **Step 3: 在微信开发者工具中编译**

确认九个路由可打开、核心按钮可跳转、答题流程可走通且控制台无错误。

- [ ] **Step 4: 对照静态稿完成视觉 QA**

将相同页面的实现截图与 `design/screens/` 原稿并排比较，修复 P0/P1/P2 问题，并在 `design-qa.md` 记录最终结果。
