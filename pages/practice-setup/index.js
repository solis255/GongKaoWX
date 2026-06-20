const { listModules, pickQuestions, pickMixedQuestions } = require('../../services/question-bank');
const { createSession } = require('../../services/practice-session');

Page({
  data: {
    module: null,
    mode: 'module',
    selectedModules: [],
    count: 20,
    random: true,
    onlyNew: false,
    countOptions: [
      { value: 10, label: '10题' },
      { value: 20, label: '20题' },
      { value: 30, label: '30题' },
      { value: 60, label: '全部' }
    ]
  },
  onLoad(options) {
    const app = getApp();
    const mode = options.mode === 'mixed' || app.globalData.practiceMode === 'mixed' ? 'mixed' : 'module';
    const moduleKey = options.module || app.globalData.moduleKey || 'verbal';
    const module = listModules().find(({ key }) => key === moduleKey) || listModules()[2];
    const selectedModules = mode === 'mixed' ? (app.globalData.mixedModuleKeys || listModules().map(({ key }) => key)) : [module.key];
    app.globalData.moduleKey = mode === 'mixed' ? null : module.key;
    const saved = app.globalData.storage.getSettings();
    this.setData({ module, mode, selectedModules, ...(saved || {}) });
  },
  setCount(event) { this.setData({ count: Number(event.currentTarget.dataset.count) }); },
  setOrder(event) { this.setData({ random: event.currentTarget.dataset.random === 'true' }); },
  toggleNew(event) { this.setData({ onlyNew: event.detail.value }); },
  start() {
    const { module, mode, selectedModules, count, random, onlyNew } = this.data;
    const app = getApp();
    const excludeIds = onlyNew ? [...new Set(app.globalData.storage.getAnswerEvents().map(({ questionId }) => questionId))] : [];
    const questions = mode === 'mixed'
      ? pickMixedQuestions(count, { moduleKeys: selectedModules, excludeIds })
      : pickQuestions(module.key, count, random, excludeIds);
    if (!questions.length) { wx.showToast({ title: '没有可用题目，请关闭“只练未做题”', icon: 'none' }); return; }
    const begin = () => {
      app.globalData.storage.saveSettings({ count, random, onlyNew });
      app.globalData.session = createSession(mode === 'mixed' ? 'mixed' : module.key, questions, { count, random, onlyNew, mode });
      wx.redirectTo({ url: '/pages/question/index' });
    };
    if (questions.length < count) {
      wx.showModal({ title: '题量不足', content: `当前可练 ${questions.length} 题，是否开始？`, success: ({ confirm }) => { if (confirm) begin(); } });
    } else begin();
  }
});
