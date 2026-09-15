# 项目代码导航与文件说明

> 用途：在后续修改中先查本文件，快速定位页面、业务逻辑、题库和测试，避免重复扫描整个仓库。
>
> 最近完整扫描：2026-09-14。扫描范围为项目根目录下除 `.git/` 内部数据之外的全部 124 个受版本管理的项目文件；新增、删除或重命名文件后应同步更新本导航。

## 1. 项目概览

这是一个不依赖后端和第三方运行时的私人刷题微信小程序。项目不再内置题库；用户自行创建科目、导入 JSON 题库，设置保存在微信缓存，私人题库按分块保存在小程序本地文件目录。

- 运行入口：`app.js`、`app.json`、`app.wxss`
- 页面：`pages/` 下 17 个页面，每页由 `index.js`、`index.json`、`index.wxml`、`index.wxss` 四件套组成
- 公共组件：`components/` 下的顶部栏、底部导航、进度条和饼图
- 核心业务：`services/` 下的自定义科目、私人题库、JSON 导入、会话、存储、进度统计和安全区布局
- JSON 参考：`questions/user-bank-import.schema.json`、`questions/user-bank-import.example.json`
- 自动化测试：`tests/`
- 设计依据与截图：`docs/design/`、`design/`

技术约束：CommonJS 用于小程序运行代码，`.mjs` 用于 Node.js 脚本和测试；没有 `package.json`，正常运行和测试不要求安装 npm 依赖。

## 2. 修改需求快速定位

| 想修改的内容 | 首先查看 | 通常还要同步查看 |
| --- | --- | --- |
| 页面路由、全局组件、窗口配置 | `app.json` | 对应 `pages/*`、`components/*` |
| 全局初始化、当前练习上下文 | `app.js` | `services/storage.js`、`services/layout.js` |
| 全局颜色、按钮、卡片、通用工具类 | `app.wxss` | 对应页面或组件的 `index.wxss` |
| 首页目标、考试倒计时、科目进度、继续刷题 | `pages/home/index.js` | `services/user-progress.js`、`services/question-bank.js`、`services/storage.js` |
| 题库、科目分组或综合随机入口 | `pages/bank/index.js` | `services/question-bank.js`、`pages/practice-setup/index.js` |
| 新增、改名或删除科目 | `pages/subjects/index.js` | `services/subject-storage.js`、`services/user-bank-storage.js` |
| 题量、随机、只练未做题 | `pages/practice-setup/index.js` | `services/question-bank.js`、`services/storage.js` |
| 选项、提交、计时、收藏 | `pages/question/index.js` | `services/practice-session.js`、`services/storage.js` |
| 答案解析、资料、来源链接 | `pages/analysis/index.js` | `services/question-bank.js`、私人题库本地文件 |
| 答题卡、跳题规则 | `pages/question-card/index.js` | `services/practice-session.js` |
| 练习结果和再次练习 | `pages/result/index.js` | `services/practice-session.js`、`services/storage.js` |
| 错题的判定、筛选和重练 | `pages/wrong/index.js` | `services/user-progress.js`、`services/storage.js` |
| 周趋势、正确率、连续天数 | `pages/stats/index.js` | `services/user-progress.js` |
| 收藏列表 | `pages/favorites/index.js` | `services/storage.js`、`services/question-bank.js` |
| 每题练习历史 | `pages/history/index.js` | `services/user-progress.js`、`services/storage.js` |
| 每日目标 | `pages/goal/index.js` | `services/storage.js` |
| 个人页数据、资料与考试设置 | `pages/profile/index.js` | `services/user-progress.js`、`services/storage.js` |
| 打卡月历、按日题量和月份切换 | `pages/checkin/index.js` | `services/user-progress.js`、`services/storage.js` |
| 微信胶囊、状态栏、安全区 | `services/layout.js` | `app.js`、`components/app-header/index.js` |
| 修改题目或解析 | 导出的私人题库 JSON | 按导入 Schema 修改后重新导入 |
| 导入私人 JSON 题库 | `pages/import-bank/index.js` | `services/user-bank-import.js`、`services/user-bank-storage.js` |
| 私人题库展示、导出和删除 | `pages/bank/index.js` | `pages/bank-trash/index.js`、`services/question-bank.js` |
| 私人题库 Schema | `questions/user-bank-import.schema.json` | `questions/user-bank-import.example.json` |
| 增加/删除一个页面 | `app.json` | 新页面四件套、`tests/miniprogram-structure.test.mjs` |
| 改本地缓存结构 | `services/storage.js` | 所有读取该数据的页面、`tests/storage.test.mjs`、迁移兼容 |

## 3. 核心运行链路

```text
app.js 初始化 storage 与安全区布局
  ├─ 首页 home ─────────────┐
  ├─ 题库 bank ─────────────┼─> practice-setup 创建 session
  ├─ 错题 wrong / 收藏 / 历史 ┘          │
  │                                     v
  │                              question 选择并提交
  │                                     │ 保存 answer event
  │                                     v
  │                              analysis 查看解析
  │                                │           │
  │                                ├─ 下一题 ──┘
  │                                └─ 最后一题 -> result 保存练习汇总
  │
  └─ user-progress 从 answer events 派生首页、错题、统计、个人页、打卡月历和历史
```

`getApp().globalData` 保存临时运行态：

- `moduleKey`：当前单题库 ID；科目/综合练习时为 `null`
- `practiceMode`：`module` 或 `mixed`
- `mixedModuleKeys`：科目/综合练习选中的题库 ID
- `practiceTitle`：科目练习或综合练习的展示标题
- `session`：当前练习会话；仅在内存中，结束返回首页时清空
- `storage`：`createStorage()` 创建的本地存储门面
- `userBankStorage`：私人题库本地文件仓库；题目按每块 200 题保存
- `subjectStorage`：自定义科目缓存与升级迁移门面
- `layout`：微信窗口与胶囊计算出的安全区数据

## 4. 关键数据约定

### 4.1 科目与题库 ID

科目 ID 形如 `subject-<时间>-<随机后缀>`，保存在 `guokao_custom_subjects_v1`。题库 ID 形如 `user-bank-<时间>-<随机后缀>`，题目导入后获得 `<题库ID>:<源题目ID>` 的全局 ID。题库 manifest 的 `subjectId` 指向所属科目；科目改名不需要重写题库。项目启动时会把旧版本私人题库按原 `category` 自动迁移到科目，并清理已删除的六套内置题库的旧学习记录。

### 4.2 答题事件与会话

答题事件是统计的事实源，主要字段为：`questionId`、`moduleKey`、`userAnswer`、`correct`、`elapsedMs`、`answeredAt`。单选题的 `userAnswer` 是字符串，多选题是规范化后的答案数组。错题状态取同一题的最新有效事件，而不是直接依赖旧版错题 ID 列表。

练习会话由 `services/practice-session.js` 创建，主要字段为：`moduleKey`、`questions`、`settings`、`currentIndex`、`selectedAnswer`、`submitted`、`answers`、`startedAt`。页面之间通过 `globalData.session` 共享它。

### 4.3 微信本地缓存键

全部定义在 `services/storage.js` 的 `KEYS`：

| 键值 | 用途 |
| --- | --- |
| `guokao_answer_events` | 每次提交答案的事件；进度、错题、统计、历史的主要数据源 |
| `guokao_favorite_records` | 带收藏时间的新收藏记录 |
| `guokao_favorites` | 旧版收藏 ID 列表；保留用于兼容和迁移 |
| `guokao_practice_history` | 完整练习结束后的汇总记录 |
| `guokao_practice_settings` | 上次题量、顺序和“只练未做题”设置 |
| `guokao_daily_goal` | 每日目标，合法范围 1–200 |
| `guokao_wrong_answers` | 旧版错题 ID；当前错题视图以答题事件推导为准 |
| `guokao_user_profile_v1` | 本地用户昵称和持久化头像路径；无数据时回退为“备考用户” |
| `guokao_exam_config_v1` | 考试名称与 `YYYY-MM-DD` 日期；剩余天数在页面刷新时动态计算，不写入缓存 |
| `guokao_custom_subjects_v1` | 自定义科目实体；包含稳定 ID、名称和创建/更新时间 |

## 5. 全部文件说明

### 5.1 根目录

| 文件 | 作用 |
| --- | --- |
| `.gitignore` | 忽略 macOS 文件、旧工具目录和本机私有微信配置 `project.private.config.json`。 |
| `README.md` | 项目对外首页：功能、预览、结构、运行、题库维护、测试、数据与许可证说明。 |
| `PROJECT_MAP.md` | 本文件；供维护者和后续代码修改快速定位。 |
| `CONTENT_NOTICE.md` | 题库来源、非官方声明、版权边界、隐私、本地数据和敏感配置说明。 |
| `LICENSE` | 程序代码的 MIT License；题库/第三方资料边界另见 `CONTENT_NOTICE.md`。 |
| `app.js` | 小程序入口；声明全局练习上下文，启动时创建 storage，并计算微信状态栏/胶囊安全区。 |
| `app.json` | 注册 17 个页面、3 个全局组件、自定义导航样式、懒加载和 sitemap。页面数组顺序决定首页。 |
| `app.wxss` | 全局设计令牌与通用类：页面背景、标题、卡片、渐变按钮、标签、行布局、颜色等。 |
| `project.config.json` | 微信开发者工具公开配置；测试 AppID、基础库、编译压缩设置和打包忽略目录。 |
| `project.private.config.json` | 当前机器的微信开发者工具私有覆盖配置；已被 Git 忽略，不应提交 AppID/密钥。 |
| `sitemap.json` | 微信页面索引规则；当前允许索引全部页面。 |

### 5.2 公共组件 `components/`

| 文件 | 作用 |
| --- | --- |
| `components/app-header/index.js` | 顶部栏逻辑；接收标题、右侧文字、返回开关和布局尺寸，解析安全高度，处理返回/右侧点击。 |
| `components/app-header/index.json` | 声明该目录是微信自定义组件。 |
| `components/app-header/index.wxml` | 顶部栏结构：返回圆形按钮、居中标题、避开胶囊的右侧操作区。 |
| `components/app-header/index.wxss` | 顶部栏定位、标题、左右操作区和返回图标样式。 |
| `components/bottom-nav/index.js` | 五栏导航配置与跳转逻辑：首页、题库、错题、打卡、我的；用 `reLaunch` 切换一级页面。 |
| `components/bottom-nav/index.json` | 声明底部导航为微信自定义组件。 |
| `components/bottom-nav/index.wxml` | 循环渲染五个导航项，并按 `active` 标记当前页。 |
| `components/bottom-nav/index.wxss` | 固定底栏、五等分窄屏排版、安全区、选中颜色和指示条样式。 |
| `components/progress-bar/index.js` | 声明 `value` 百分比和 `accent` 色系两个属性。 |
| `components/progress-bar/index.json` | 声明进度条为微信自定义组件。 |
| `components/progress-bar/index.wxml` | 轨道与按百分比设置宽度的填充条。 |
| `components/progress-bar/index.wxss` | 进度条轨道及绿色/蓝色渐变填充样式。 |
| `components/pie-chart/index.js` | 原生 Canvas 2D 饼图；按设备 DPR 缩放画布，为科目循环分配 8 种柔和配色。 |
| `components/pie-chart/index.json` | 声明该目录是微信自定义组件。 |
| `components/pie-chart/index.wxml` | 饼图 Canvas 以及包含科目名、题数和百分比的图例。 |
| `components/pie-chart/index.wxss` | 饼图尺寸、图例行、颜色标记和数值对齐样式。 |

### 5.3 页面 `pages/`

所有页面的 `index.json` 当前都只设置 `navigationStyle: custom`。修改功能主要看 `index.js`，修改结构/文案看 `index.wxml`，修改视觉看 `index.wxss`。

#### `pages/home/` 首页

| 文件 | 作用 |
| --- | --- |
| `pages/home/index.js` | 每分钟刷新问候、日期、考试倒计时、连续天数、今日目标、科目进度和错题数；倒计时设置入口用 `reLaunch` 进入个人页编辑区。 |
| `pages/home/index.json` | 首页自定义导航配置。 |
| `pages/home/index.wxml` | 首页结构：问候日历、考试倒计时/未设置入口、今日目标、科目进度、空状态、继续刷题、错题提醒和底栏。 |
| `pages/home/index.wxss` | 首页头部、日历、绿蓝柔和倒计时卡、目标卡、模块列表和提醒卡等样式。 |

#### `pages/bank/` 题库

| 文件 | 作用 |
| --- | --- |
| `pages/bank/index.js` | 按科目分组加载私人题库及完成度；支持单题库/随机练习、修改科目、导入、导出和移入回收站。 |
| `pages/bank/index.json` | 题库页自定义导航配置。 |
| `pages/bank/index.wxml` | 题库/随机模式、科目分组、归属选择器、题库进度、空状态和三栏等宽管理入口。 |
| `pages/bank/index.wxss` | 分段控件、科目标题、题库行、归属选择器、进度与空状态；题库页局部预留底栏高度和 `safe-area-inset-bottom`。 |

#### `pages/practice-setup/` 练习设置

| 文件 | 作用 |
| --- | --- |
| `pages/practice-setup/index.js` | 读取单题库/科目/综合模式及上次设置；控制题量、顺序、只练未做题，按题库抽题后创建 session。 |
| `pages/practice-setup/index.json` | 练习设置页自定义导航配置。 |
| `pages/practice-setup/index.wxml` | 模块概览、题量选项、顺序选项、未做题开关和开始按钮。 |
| `pages/practice-setup/index.wxss` | 模块头图、设置卡、选项 chip、开关和开始按钮样式。 |

#### `pages/question/` 答题

| 文件 | 作用 |
| --- | --- |
| `pages/question/index.js` | 加载当前题和共享材料；单选题替换选择，多选题切换勾选；处理计时、收藏、上一题、提交答题事件并进入解析。 |
| `pages/question/index.json` | 答题页自定义导航配置。 |
| `pages/question/index.wxml` | 题号/进度、难度、材料、题干、A–D 选项、多选提示与勾选状态、收藏、题卡和提交按钮。 |
| `pages/question/index.wxss` | 固定头部/底部操作栏、滚动答题区、材料和选项状态样式。 |

#### `pages/analysis/` 答案解析

| 文件 | 作用 |
| --- | --- |
| `pages/analysis/index.js` | 读取已提交记录，按单选字符串或多选集合标记全部正确项、已选项和误选项；展示用时、材料和来源并处理解析页跳转。 |
| `pages/analysis/index.json` | 解析页自定义导航配置。 |
| `pages/analysis/index.wxml` | 题目回显、选项对错、结果横幅、解析、知识点、可展开来源和底部操作栏。 |
| `pages/analysis/index.wxss` | 解析滚动区、正确/错误状态、解析卡、来源列表和底部按钮样式。 |

#### `pages/question-card/` 答题卡

| 文件 | 作用 |
| --- | --- |
| `pages/question-card/index.js` | 构造题号状态，统计已完成/正确/错误；允许回看已解锁题，阻止跳到未来题。 |
| `pages/question-card/index.json` | 答题卡页自定义导航配置。 |
| `pages/question-card/index.wxml` | 汇总数字、题号网格和正确/错误/当前/锁定图例。 |
| `pages/question-card/index.wxss` | 汇总卡、题号网格、四类状态和图例样式。 |

#### `pages/result/` 练习结果

| 文件 | 作用 |
| --- | --- |
| `pages/result/index.js` | 汇总正确率和用时，保存练习汇总；处理错题回顾、复用模式再练一组和清空会话返回首页。 |
| `pages/result/index.json` | 结果页自定义导航配置。 |
| `pages/result/index.wxml` | 正确率圆环、用时/平均/连续正确、答题分布、模块表现和结果操作。 |
| `pages/result/index.wxss` | 结果圆环、指标卡、分布条、表现卡和操作区样式。 |

#### `pages/wrong/` 错题本

| 文件 | 作用 |
| --- | --- |
| `pages/wrong/index.js` | 从最新答题事件派生错题，按自定义科目筛选并统计本周巩固；创建错题会话或进入该科目练习。 |
| `pages/wrong/index.json` | 错题页自定义导航配置。 |
| `pages/wrong/index.wxml` | 模块筛选、错题/巩固摘要、空状态、错题列表、重新练习按钮和底栏。 |
| `pages/wrong/index.wxss` | 横向筛选、摘要、错题条目、空状态和按钮样式。 |

#### `pages/stats/` 学习统计

| 文件 | 作用 |
| --- | --- |
| `pages/stats/index.js` | 从答题事件计算本周每日题量、总体正确率、连续学习和各模块正确率。 |
| `pages/stats/index.json` | 统计页自定义导航配置。 |
| `pages/stats/index.wxml` | 本周指标、七日柱状图、科目正确率进度和累计数据。 |
| `pages/stats/index.wxss` | 统计头卡、柱状图、科目正确率和汇总卡样式。 |

#### `pages/profile/` 我的

| 文件 | 作用 |
| --- | --- |
| `pages/profile/index.js` | 加载本地用户资料、个人统计、今日科目分布与考试配置；处理资料编辑、原生日期选择、考试保存/清除和菜单跳转。 |
| `pages/profile/index.json` | 个人页自定义导航配置，局部注册 `pie-chart` 组件。 |
| `pages/profile/index.wxml` | 用户资料区、三项指标、今日刷题饼图/空状态、考试展示/编辑卡、功能菜单、复核提示和底栏。 |
| `pages/profile/index.wxss` | 用户头部、资料编辑、指标、饼图、考试设置表单/展示卡、菜单和背景装饰样式。 |

#### `pages/checkin/` 打卡日历

| 文件 | 作用 |
| --- | --- |
| `pages/checkin/index.js` | 从答题事件加载月度活动和连续天数；处理上月、下月、回到今天及日期详情选择。 |
| `pages/checkin/index.json` | 打卡日历页自定义导航配置。 |
| `pages/checkin/index.wxml` | 连续/本月汇总、周一到周日月历、每日题量、今日/未来状态、日期详情卡及选中的底栏入口。 |
| `pages/checkin/index.wxss` | 汇总渐变卡、月份工具栏、月历网格、打卡/今日/未来状态，并为固定底栏和安全区预留空间。 |

#### `pages/goal/` 每日学习目标

| 文件 | 作用 |
| --- | --- |
| `pages/goal/index.js` | 读取目标，支持预设/手输，校验 1–200 的整数并保存。 |
| `pages/goal/index.json` | 目标页自定义导航配置。 |
| `pages/goal/index.wxml` | 数字输入、10/20/30/50 快捷选项、错误提示和保存按钮。 |
| `pages/goal/index.wxss` | 目标输入卡、快捷选项、错误和保存按钮样式。 |

#### `pages/favorites/` 我的收藏

| 文件 | 作用 |
| --- | --- |
| `pages/favorites/index.js` | 将收藏记录回查成完整题目，按收藏时间倒序；支持单题练习、取消收藏和空状态去题库。 |
| `pages/favorites/index.json` | 收藏页自定义导航配置。 |
| `pages/favorites/index.wxml` | 收藏题卡列表、取消收藏操作和空状态。 |
| `pages/favorites/index.wxss` | 收藏列表、题干、取消按钮和空状态样式。 |

#### `pages/history/` 练习记录

| 文件 | 作用 |
| --- | --- |
| `pages/history/index.js` | 按题聚合答题事件，显示次数、错次、最新结果和时间；支持从历史进入单题重练。 |
| `pages/history/index.json` | 历史页自定义导航配置。 |
| `pages/history/index.wxml` | 历史题卡列表、最近对错、次数/时间和空状态。 |
| `pages/history/index.wxss` | 历史列表、状态文字、题干和空状态样式。 |

#### `pages/import-bank/` 私人题库导入

| 文件 | 作用 |
| --- | --- |
| `pages/import-bank/index.js` | 从微信会话选择不超过 10MB 的 JSON，读取并调用导入器校验，保存预览结果，确认后事务式写入私人题库。 |
| `pages/import-bank/index.json` | 导入页自定义导航配置。 |
| `pages/import-bank/index.wxml` | 文件选择、读取状态、有效/错误/重复统计、问题列表和确认导入按钮。 |
| `pages/import-bank/index.wxss` | 上传卡、校验摘要、问题列表和导入状态样式。 |

#### `pages/bank-trash/` 题库回收站

| 文件 | 作用 |
| --- | --- |
| `pages/bank-trash/index.js` | 列出已删除私人题库，支持恢复；永久删除时级联清理收藏、答题事件和练习汇总。 |
| `pages/bank-trash/index.json` | 回收站自定义导航配置。 |
| `pages/bank-trash/index.wxml` | 回收站题库列表、恢复、永久删除和空状态。 |
| `pages/bank-trash/index.wxss` | 回收站列表、操作按钮和空状态样式。 |

#### `pages/subjects/` 自定义科目

| 文件 | 作用 |
| --- | --- |
| `pages/subjects/index.js` | 加载科目及其题库数，处理新增、改名和安全删除；仍被活动或回收站题库使用时阻止删除。 |
| `pages/subjects/index.json` | 科目管理页自定义导航配置。 |
| `pages/subjects/index.wxml` | 科目名称输入、题库数量、改名/删除操作和空状态。 |
| `pages/subjects/index.wxss` | 新增表单、科目列表、操作按钮和空状态样式。 |

### 5.4 核心服务 `services/`

| 文件 | 作用与主要 API |
| --- | --- |
| `services/layout.js` | 防御性读取微信窗口信息并计算状态栏、胶囊、导航栏和内容安全区。导出 `computeLayoutMetrics`、`getSafeWindowInfo`、`resolvePositiveMetric`。 |
| `services/question-bank.js` | 唯一的题库运行时入口；只加载私人题库，生成科目汇总，校验题目，执行单题库/混合抽题、排除已做题和按 ID 查题。 |
| `services/practice-session.js` | 纯函数式练习状态机；创建会话、规范化单选/多选答案、按集合判定多选正确性、前后移动、跳题、构造答题卡、汇总结果。 |
| `services/storage.js` | 封装微信同步缓存；管理答题事件、收藏、目标、练习、用户资料和考试配置，提供 `getExamConfig()` / `saveExamConfig()` / `clearExamConfig()` 及严格日期校验。 |
| `services/subject-storage.js` | 管理自定义科目的新增、改名、唯一性和安全删除；启动时为旧私人题库迁移 `subjectId`。 |
| `services/user-progress.js` | 从答题事件推导各类学习统计；除今日分布和考试倒计时外，导出 `getDailyActivity()`、`getMonthActivity()`、`shiftCalendarMonth()` 供打卡日历聚合每日题量、生成平闰年月历及跨年切换。 |
| `services/user-bank-import.js` | 私人 JSON 导入核心：严格校验单选字符串答案或多选答案数组、文本规范化、SHA-256、题目指纹、重复检测和有效题过滤。 |
| `services/user-bank-storage.js` | 私人题库本地文件仓库：200题分块、暂存后提交、全局题目 ID、科目归属、加载/导出、回收站、恢复和永久删除；提供内存适配器用于测试。 |

职责边界：页面负责微信生命周期、渲染数据和跳转；可测试的抽题、会话和统计规则应放在 `services/`，不要复制到多个页面。

### 5.5 题库 `questions/`

| 文件 | 作用 |
| --- | --- |
| `questions/user-bank-import.schema.json` | 私人题库导入 V1 Schema；支持可选科目建议、单选字符串答案、多选答案数组，并兼容省略 `type` 的单选 JSON。 |
| `questions/user-bank-import.example.json` | 含科目建议、单选题和共享材料多选题的可导入示例，用于大模型输出参考和真机测试。 |

题库字段重点：`id`、`type`、`category`、`subtype`、`difficulty`、`stem`、`materialId`、`options`、`answer`、`explanation`、`knowledgePoints`、`sourceRefs`、`status`。

### 5.6 自动化测试 `tests/`

| 文件 | 覆盖范围 |
| --- | --- |
| `tests/layout.test.mjs` | 安全区计算、缺失/畸形指标、矛盾胶囊数据、微信 API 回退、组件布局优先级，以及题库底部工具栏的安全区/窄屏布局。 |
| `tests/miniprogram-structure.test.mjs` | 页面/组件事件、个人资料、饼图、考试日期选择、首页倒计时与打卡日历接线，以及答题交互、错题数据源和题库结构。 |
| `tests/practice-session.test.mjs` | 会话初始态、单选/多选提交、多选答案顺序无关判定、错误选项组合、前后移动、题卡锁定和结果汇总。 |
| `tests/question-bank.test.mjs` | 无内置题库、私人题库加载、科目汇总、单题库抽题、按 ID 查题、混合均衡抽题、去重/排除和边界。 |
| `tests/storage.test.mjs` | 现有缓存行为、用户资料，以及考试配置默认值、持久化、严格日期/名称校验、坏数据回退和清除。 |
| `tests/user-progress.test.mjs` | 现有学习统计、今日科目分布、考试倒计时，以及打卡日历的同日聚合、未来过滤、月首偏移、平闰年和跨年切换规则。 |
| `tests/user-bank-import.test.mjs` | SHA-256、现有单选题库兼容、多选答案规范化/坏数据拒绝、重复检测及严格字段校验。 |
| `tests/user-bank-storage.test.mjs` | 私人题库导入、科目必填/修改/导出、单选/多选持久化、全局 ID、加载、回收站和永久删除。 |
| `tests/subject-storage.test.mjs` | 科目名称规范化、唯一性、新增/改名/安全删除、稳定 ID，以及旧私人题库科目迁移。 |

### 5.7 设计与文档

| 文件 | 作用 |
| --- | --- |
| `docs/design/2026-06-19-guokao-mini-program-screen-flow.md` | “晨光学习站”视觉基准、390×844 画布、页面路由、核心跳转、答题状态、数据对应和截图清单。注意其中部分“建议路由”是早期命名，实际路由以 `app.json` 为准。 |
| `design/cover.png` | README 顶部的项目封面图。 |
| `design/screens/01-home.png` | 首页视觉基准截图。 |
| `design/screens/02-question-bank.png` | 题库页视觉基准截图。 |
| `design/screens/03-practice-setup.png` | 练习设置页视觉基准截图。 |
| `design/screens/04-question.png` | 答题页视觉基准截图。 |
| `design/screens/05-answer-analysis.png` | 答案解析页视觉基准截图。 |
| `design/screens/06-practice-result.png` | 练习结果页视觉基准截图。 |
| `design/screens/07-wrong-answers.png` | 错题本视觉基准截图。 |
| `design/screens/08-learning-stats.png` | 学习统计页视觉基准截图。 |
| `design/screens/09-profile.png` | 个人页视觉基准截图。 |

## 6. 页面路由与跳转关系

| 路由 | 入口 | 主要去向 |
| --- | --- | --- |
| `/pages/home/index` | 应用首页、底栏 | 练习设置、错题、目标、个人页考试设置 |
| `/pages/bank/index` | 底栏、空状态 | 练习设置 |
| `/pages/practice-setup/index` | 首页/题库/错题 | 答题 |
| `/pages/question/index` | 设置、错题、收藏、历史 | 解析、答题卡、返回 |
| `/pages/analysis/index` | 答题提交、答题卡 | 下一题、结果、答题卡 |
| `/pages/question-card/index` | 答题/解析底栏 | 已解锁的答题或解析页 |
| `/pages/result/index` | 最后一题解析 | 错题、再次设置、首页 |
| `/pages/wrong/index` | 底栏、首页、结果 | 单题答题、错题会话、题库/设置 |
| `/pages/stats/index` | 个人页正确率 | 返回个人页 |
| `/pages/profile/index` | 底栏、首页倒计时卡 | 资料/考试设置、目标、历史、收藏、统计 |
| `/pages/checkin/index` | 底栏“打卡” | 月份切换、回到今天、查看每日刷题明细 |
| `/pages/goal/index` | 首页目标卡、个人菜单 | 保存后返回 |
| `/pages/favorites/index` | 个人菜单/收藏指标 | 单题答题、题库 |
| `/pages/history/index` | 个人菜单/累计指标 | 单题答题、题库 |
| `/pages/import-bank/index` | 题库页“导入 JSON” | 校验预览、确认后返回题库 |
| `/pages/bank-trash/index` | 题库页“回收站” | 恢复或永久删除私人题库 |
| `/pages/subjects/index` | 题库页/导入页“管理科目” | 新增、改名、删除后返回 |

## 7. 修改时的必要检查

1. 改页面事件：确认 WXML 的 `bindtap`/`bindinput`/`bindchange` 对应 `index.js` 中确实存在同名方法。
2. 改题库导入格式：同步 `questions/user-bank-import.schema.json`、示例、导入器、存储导出和相关测试。
3. 改统计含义：先确认应使用“所有事件”“最新一次事件”还是“去重后的答对题目”；三者结果不同。
4. 改错题：当前规则是“最新一次答错即在错题本；之后答对即移除”，本周答对历史错题计为巩固。
5. 改路由：同步 `app.json`、入口页面、目标页面和结构测试。
6. 改安全区/顶部布局：用 `services/layout.js` 的共享结果，不要在页面重新硬编码微信胶囊尺寸。
7. 改缓存字段：保留旧数据的容错或迁移路径，避免用户更新后丢失本地学习记录。
8. 提交前检查 `project.private.config.json`、真实 AppID、密钥、调试日志和用户数据未被 Git 跟踪。

## 8. 当前扫描与验证备注

- 扫描时工作树中 `project.config.json` 已有未提交修改；它不是本次文档生成所改动的文件，后续修改时应保留用户现有变更。
- `project.private.config.json` 存在于本机且未被 Git 跟踪，符合 `.gitignore` 约定。
- 2026-08-21 执行 9 个测试文件、68 项测试全部通过；Node 16 下需逐个直接执行 `.test.mjs` 才能展开内部用例。
- 2026-09-14 执行 9 个测试文件、87 项测试全部通过；五项功能的核心数据、页面接线、日期边界和布局规则均已覆盖。
- 六套旧内置 JSON 题库、六个 generated 模块、固定题库 Schema、同步/校验脚本及对应测试已删除；运行时只读取用户导入的私人题库。

## 9. 如何维护本文件

出现以下变化时，应同步更新本文件：新增/删除/重命名页面或组件；服务职责或导出 API 改变；题库结构、模块或生成流程改变；缓存键或统计口径改变；路由和核心跳转改变；新增脚本、测试、文档或设计资产。

小范围样式或文案调整通常不需要改导航说明；如果文件的职责、调用关系或维护方式发生变化，则必须更新。
