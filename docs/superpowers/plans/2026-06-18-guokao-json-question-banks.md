# 国考客观题 JSON 题库实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在项目根目录 `questions/` 中生成六套可由微信小程序直接读取的国考客观题 JSON 题库，每套 60 题，共 360 题，并通过结构、数量、答案和重复性校验。

**Architecture:** 先建立统一 JSON Schema、自动校验器和测试，再并行生成六个互不共享写入的题库文件。生成结束后运行全库校验，并由独立复核任务重算数量关系和资料分析题。

**Tech Stack:** JSON Schema Draft 2020-12、Node.js 内置测试运行器、ES modules、PowerShell、Codex subagents。

---

## 文件结构

- Create: `questions/schema.json`，定义题库、材料、题目、选项和来源字段。
- Create: `questions/politics.json`，政治理论 60 题。
- Create: `questions/common-sense.json`，常识判断 60 题。
- Create: `questions/verbal.json`，言语理解与表达 60 题。
- Create: `questions/quantitative.json`，数量关系 60 题。
- Create: `questions/reasoning.json`，判断推理 60 题。
- Create: `questions/data-analysis.json`，资料分析 12 份材料、每份 5 题。
- Create: `scripts/validate-question-banks.mjs`，执行无需第三方依赖的结构和内容校验。
- Create: `tests/validate-question-banks.test.mjs`，覆盖合法题库与主要失败分支。

### Task 1: 建立题库契约和校验器

**Files:**
- Create: `tests/validate-question-banks.test.mjs`
- Create: `scripts/validate-question-banks.mjs`
- Create: `questions/schema.json`

- [ ] **Step 1: 编写失败测试**

测试必须覆盖：正确的四选一题通过；选项不足四个失败；答案不在选项中失败；ID 重复失败；`questionCount` 不匹配失败；引用不存在的 `materialId` 失败；难度数量不是 18/30/12 时失败。

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBank } from '../scripts/validate-question-banks.mjs';

test('rejects an answer that is not one of A-D', () => {
  const bank = makeValidBank();
  bank.questions[0].answer = 'E';
  assert.match(validateBank(bank, 'sample.json').join('\n'), /answer/);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/validate-question-banks.test.mjs`

Expected: FAIL，错误指向 `scripts/validate-question-banks.mjs` 尚不存在。

- [ ] **Step 3: 实现 Schema 和最小校验器**

导出 `validateBank(bank, fileName)` 和 `validateDirectory(directory)`。校验器读取 `questions/*.json`，跳过 `schema.json`，返回按文件分组的错误。命令行接收零个或一个路径参数：无参数时校验整个 `questions/`，传入文件路径时只校验该文件；发现错误时退出码为 1。

```js
export function validateBank(bank, fileName) {
  const errors = [];
  if (bank.questionCount !== bank.questions?.length) errors.push(`${fileName}: questionCount mismatch`);
  const ids = new Set();
  for (const question of bank.questions ?? []) {
    if (ids.has(question.id)) errors.push(`${fileName}: duplicate id ${question.id}`);
    ids.add(question.id);
    const keys = question.options?.map(({ key }) => key) ?? [];
    if (keys.join(',') !== 'A,B,C,D') errors.push(`${question.id}: options must be A-D`);
    if (!keys.includes(question.answer)) errors.push(`${question.id}: answer is not an option`);
  }
  return errors;
}
```

- [ ] **Step 4: 运行测试并确认通过**

Run: `node --test tests/validate-question-banks.test.mjs`

Expected: 全部测试 PASS。

- [ ] **Step 5: 提交契约和校验器**

```powershell
git add -- 'questions/schema.json' 'scripts/validate-question-banks.mjs' 'tests/validate-question-banks.test.mjs'
git commit -m "test: add question bank validation contract"
```

### Task 2: 生成政治理论题库

**Files:**
- Create: `questions/politics.json`

- [ ] **Step 1: 检索并记录来源**

以 2026 国考大纲、政府工作报告、法律法规和政府公开政策文件为主。第三方题库只用于观察题型与难度。所有时效性事实填写 `publishedAt` 和 `accessedAt`。

- [ ] **Step 2: 生成 60 题**

分布为党的创新理论 20 题、党和国家方针政策 15 题、法治与国家治理 10 题、经济社会文化生态建设 15 题。难度固定为 easy 18、medium 30、hard 12，ID 为 `politics-001` 至 `politics-060`。

- [ ] **Step 3: 校验文件**

Run: `node scripts/validate-question-banks.mjs 'questions/politics.json'`

Expected: `politics.json: 60 questions, valid`。

### Task 3: 生成常识判断题库

**Files:**
- Create: `questions/common-sense.json`

- [ ] **Step 1: 检索并记录来源**

来源优先级为法律法规、国家统计和部委公开资料；第三方题库用于题型参考。

- [ ] **Step 2: 生成 60 题**

分布为法律 12 题、经济 8 题、科技 10 题、历史文化 10 题、地理环境 8 题、公共管理与时政常识 12 题。难度为 18/30/12，ID 为 `common-sense-001` 至 `common-sense-060`。

- [ ] **Step 3: 校验文件**

Run: `node scripts/validate-question-banks.mjs 'questions/common-sense.json'`

Expected: `common-sense.json: 60 questions, valid`。

### Task 4: 生成言语理解与表达题库

**Files:**
- Create: `questions/verbal.json`

- [ ] **Step 1: 研究历年设问方式**

记录片段阅读、逻辑填空、语句表达和语句排序的常用设问方式，不复制第三方解析。

- [ ] **Step 2: 生成 60 题**

分布为片段阅读 20 题、逻辑填空 20 题、语句表达 10 题、语句排序 10 题。难度为 18/30/12，ID 为 `verbal-001` 至 `verbal-060`。

- [ ] **Step 3: 校验文件**

Run: `node scripts/validate-question-banks.mjs 'questions/verbal.json'`

Expected: `verbal.json: 60 questions, valid`。

### Task 5: 生成数量关系题库

**Files:**
- Create: `questions/quantitative.json`

- [ ] **Step 1: 研究历年考点分布**

使用公开真题页面确认常见考点和题干长度，所有数值与解析自行构造。

- [ ] **Step 2: 生成 60 题**

分布为基础运算 10 题、行程与工程 10 题、比例与百分数 10 题、几何 8 题、排列概率 8 题、数论 8 题、其他应用题 6 题。难度为 18/30/12，ID 为 `quantitative-001` 至 `quantitative-060`。

- [ ] **Step 3: 校验文件**

Run: `node scripts/validate-question-banks.mjs 'questions/quantitative.json'`

Expected: `quantitative.json: 60 questions, valid`。

### Task 6: 生成判断推理题库

**Files:**
- Create: `questions/reasoning.json`

- [ ] **Step 1: 研究历年题型**

确认图形规律、定义判断、类比推理和逻辑判断的常见结构。图形规律题只使用小程序可直接显示的文字、数字或 Unicode 符号序列，不依赖外部图片。

- [ ] **Step 2: 生成 60 题**

四个子类各 15 题。难度为 18/30/12，ID 为 `reasoning-001` 至 `reasoning-060`。

- [ ] **Step 3: 校验文件**

Run: `node scripts/validate-question-banks.mjs 'questions/reasoning.json'`

Expected: `reasoning.json: 60 questions, valid`。

### Task 7: 生成资料分析题库

**Files:**
- Create: `questions/data-analysis.json`

- [ ] **Step 1: 收集或构造材料数据**

建立 12 份材料，每份材料使用表格或短文本表达，并记录统计公报等公开来源；原创模拟数据标记为 `original`。

- [ ] **Step 2: 每份材料生成 5 题**

覆盖增长率、比重、平均数、倍数、基期量和综合判断。ID 为 `data-analysis-001` 至 `data-analysis-060`，每题引用有效 `materialId`，难度为 18/30/12。

- [ ] **Step 3: 校验文件**

Run: `node scripts/validate-question-banks.mjs 'questions/data-analysis.json'`

Expected: `data-analysis.json: 60 questions, valid`。

### Task 8: 独立复核计算题

**Files:**
- Modify: `questions/quantitative.json`
- Modify: `questions/data-analysis.json`

- [ ] **Step 1: 重算数量关系**

由未参与生成的 subagent 逐题重算 60 道数量关系题，检查正确答案、单位、取整方式和解析步骤；发现错误直接修正。

- [ ] **Step 2: 重算资料分析**

逐材料核对基础数据，重算 60 道资料分析题，检查百分号、百分点、基期与现期口径；发现错误直接修正。

- [ ] **Step 3: 重新运行校验**

Run: `node scripts/validate-question-banks.mjs`

Expected: 六个文件全部 valid，总题量 360。

### Task 9: 全库验收

**Files:**
- Modify: `questions/*.json`，只修复验收中发现的问题。

- [ ] **Step 1: 运行自动测试**

Run: `node --test tests/validate-question-banks.test.mjs`

Expected: 全部测试 PASS。

- [ ] **Step 2: 运行全库校验**

Run: `node scripts/validate-question-banks.mjs`

Expected: 六套题库、每套 60 题、总计 360 题，零错误。

- [ ] **Step 3: 检查 JSON 可解析性**

Run: `Get-ChildItem 'questions' -Filter '*.json' | ForEach-Object { Get-Content -Raw -Encoding UTF8 $_.FullName | ConvertFrom-Json | Out-Null }`

Expected: 命令退出码为 0，无解析错误。

- [ ] **Step 4: 提交题库**

```powershell
git add -- 'questions' 'scripts' 'tests'
git commit -m "feat: add prototype guokao question banks"
```
