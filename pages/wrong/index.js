const { listAllBanks, listSubjectSummaries, getQuestionById } = require('../../services/question-bank');
const { getWrongSnapshot, getHistoryRows } = require('../../services/user-progress');
const { createSession } = require('../../services/practice-session');
Page({
  data: { layout: {}, filters: [], active: 'all', items: [], allItems: [], wrongCount: 0, reinforcedCount: 0, emptyTitle: '', actionText: '' },
  onShow() {
    const app = getApp();
    const storage = app.globalData.storage;
    const banks = listAllBanks();
    const subjects = listSubjectSummaries();
    const moduleMap = new Map(banks.map((module) => [module.key, module]));
    const subjectByBank = new Map(banks.map((bank) => [bank.key, bank.subjectId]));
    const events = storage.getAnswerEvents();
    const wrongIds = new Set(getWrongSnapshot(events, new Date()).wrongIds);
    const history = new Map(getHistoryRows(events).map((row) => [row.questionId, row]));
    const allItems = [...wrongIds].map((id) => getQuestionById(id)).filter(Boolean).map((question) => ({
      ...question,
      subjectId: subjectByBank.get(question.moduleKey),
      module: moduleMap.get(question.moduleKey),
      wrongCount: history.get(question.id)?.wrongCount || 1,
    }));
    const reinforcedSubjectIds = getWrongSnapshot(events, new Date()).reinforcedIds
      .map((id) => getQuestionById(id))
      .filter(Boolean)
      .map((question) => subjectByBank.get(question.moduleKey));
    const active = this.data.active === 'all' || subjects.some(({ key }) => key === this.data.active)
      ? this.data.active : 'all';
    this.setData({
      layout: app.globalData.layout,
      filters: [{ key: 'all', name: '全部', shortName: '全部' }, ...subjects],
      allItems,
      reinforcedSubjectIds,
    });
    this.applyFilter(active);
  },
  filter(event) {
    const active = event.currentTarget.dataset.key;
    this.applyFilter(active);
  },
  applyFilter(active) {
    const items = active === 'all' ? this.data.allItems : this.data.allItems.filter(({ subjectId }) => subjectId === active);
    const reinforcedCount = active === 'all'
      ? this.data.reinforcedSubjectIds.length
      : this.data.reinforcedSubjectIds.filter((subjectId) => subjectId === active).length;
    const module = this.data.filters.find(({ key }) => key === active);
    this.setData({
      active, items, wrongCount: items.length, reinforcedCount,
      emptyTitle: active === 'all' ? '暂时还没有错题' : `${module?.name || '该科目'}暂时没有错题`,
      actionText: items.length ? `重新练习 ${items.length} 题` : (active === 'all' ? '去题库开始练习' : `开始${module?.shortName || ''}科目练习`),
    });
  },
  practice() {
    if (this.data.items.length) {
      const questions = this.data.items.map(({ id }) => getQuestionById(id)).filter(Boolean);
      const app = getApp();
      app.globalData.session = createSession('mixed', questions, { autoWrong: true, source: 'wrong' });
      wx.navigateTo({ url: '/pages/question/index' }); return;
    }
    if (this.data.active === 'all') { wx.reLaunch({ url: '/pages/bank/index' }); return; }
    const subject = this.data.filters.find(({ key }) => key === this.data.active);
    if (!subject?.bankKeys.length) { wx.reLaunch({ url: '/pages/bank/index' }); return; }
    const app = getApp();
    app.globalData.practiceMode = 'mixed';
    app.globalData.moduleKey = null;
    app.globalData.mixedModuleKeys = subject.bankKeys;
    app.globalData.practiceTitle = subject.name;
    wx.navigateTo({ url: '/pages/practice-setup/index?mode=mixed' });
  },
  openItem(event) {
    const question = getQuestionById(event.currentTarget.dataset.id);
    if (!question) return;
    getApp().globalData.session = createSession(question.moduleKey, [question], { autoWrong: true, source: 'wrong' });
    wx.navigateTo({ url: '/pages/question/index' });
  },
});
