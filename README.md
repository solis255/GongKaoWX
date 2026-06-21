# 公考刷题微信小程序

![公考刷题微信小程序封面](design/cover.png)

一个无需后端即可运行的国考客观题刷题微信小程序原型。项目内置六大模块、360 道本地模拟题，并覆盖练习设置、答题解析、错题巩固、收藏、历史与学习统计的完整闭环。

> 本项目不是官方考试产品，不代表任何考试主管部门。题目用于学习、开发与功能演示，不能替代官方考试大纲和权威资料。

## 功能

- 六大模块：政治理论、常识判断、言语理解、数量关系、判断推理、资料分析
- 模块专项与多模块混合练习
- 题量、顺序／随机和“只练未做题”设置
- 作答、计时、解析、来源展示、前后题回看与答题卡
- 错题自动维护、按模块筛选和错题重练
- 收藏、练习历史、每日目标和连续学习天数
- 今日进度、每周趋势、总体与分模块正确率
- 微信胶囊与状态栏安全区适配
- 全部学习数据保存在本机，不依赖服务器

## 界面预览

| 首页 | 答题 | 学习统计 |
| --- | --- | --- |
| ![首页](design/screens/01-home.png) | ![答题页](design/screens/04-question.png) | ![学习统计](design/screens/08-learning-stats.png) |

更多页面截图见 [`design/screens`](design/screens)。

## 技术结构

项目使用微信小程序原生技术栈，不依赖第三方运行时或后端服务。

```text
.
├── app.js / app.json / app.wxss   # 应用入口与全局样式
├── components/                    # 顶部栏、底部导航、进度条
├── pages/                         # 13 个业务页面
├── services/                      # 题库、练习会话、本地存储、统计与布局
├── questions/                     # JSON 题库及小程序可加载模块
├── scripts/                       # 题库同步与校验脚本
├── tests/                         # Node.js 自动化测试
└── design/                        # 封面、界面截图与设计说明
```

关键设计：

- `question-bank.js` 统一加载、筛选和混合抽题。
- `practice-session.js` 管理选择、提交、跳题和结果汇总。
- `storage.js` 封装微信同步缓存，记录答题事件、收藏和设置。
- `user-progress.js` 从答题事件推导错题、进度、连续学习和历史数据。

## 运行方式

1. 安装[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。
2. 克隆仓库并在开发者工具中选择“导入项目”。
3. 项目目录选择仓库根目录，AppID 可使用测试号，或在开发者工具生成的 `project.private.config.json` 中配置自己的 AppID。
4. 点击“编译”即可运行。

公开的 `project.config.json` 使用测试 AppID。`project.private.config.json` 已加入 `.gitignore`，请勿提交个人 AppID、密钥或上传配置。

## 题库维护

题库 JSON 是内容源，小程序实际加载 `questions/generated/*.js`。修改题库后执行：

```bash
node scripts/sync-question-modules.mjs
node scripts/validate-question-banks.mjs
```

每个模块固定 60 题，校验脚本会检查字段、ID、选项、答案、难度分布和材料引用。

## 测试

```bash
node --test tests/*.test.mjs
```

最近一次本地验证结果（2026-06-21）：

- 74 项测试全部通过
- 6 个题库文件全部通过校验
- 共 360 道有效题目

## 数据、版权与隐私

- 题目为项目原创模拟题或根据公开资料重新编写，不宣称收录官方真题。
- 事实性题目优先标注政府、法律法规、统计机构等公开来源；来源仅用于事实核验，不表示相关机构认可本项目。
- 未标注来源的题目按原创模拟内容处理。公开资料的版权与相关权利归原权利人所有。
- 项目不包含登录、广告、支付、网络上报或远程分析代码；学习记录仅写入微信本地缓存。
- 提交代码前请确认 `project.private.config.json`、真实 AppID、密钥、用户数据和调试日志未进入版本控制。

完整说明见 [内容与隐私说明](CONTENT_NOTICE.md)。

## 许可证

程序代码采用 [MIT License](LICENSE)。题库及引用资料的使用边界以 [内容与隐私说明](CONTENT_NOTICE.md) 为准。

