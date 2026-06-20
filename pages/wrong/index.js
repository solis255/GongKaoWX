const { listModules, getQuestionById } = require('../../services/question-bank');
const { getWrongSnapshot, getHistoryRows } = require('../../services/user-progress');
const { createSession } = require('../../services/practice-session');
Page({
  data: { layout: {}, filters: [], active: 'all', items: [], allItems: [], wrongCount: 0, reinforcedCount: 0, emptyTitle: '', actionText: '' },
  onShow() {
    const app = getApp();
    const storage = app.globalData.storage;
    const modules = listModules();
    const moduleMap = new Map(modules.map((module) => [module.key, module]));
    const events = storage.getAnswerEvents();
    const wrongIds = new Set(getWrongSnapshot(events, new Date()).wrongIds);
    const history = new Map(getHistoryRows(events).map((row) => [row.questionId, row]));
    const allItems = [...wrongIds].map((id) => getQuestionById(id)).filter(Boolean).map((question) => ({
      ...question, module: moduleMap.get(question.moduleKey), wrongCount: history.get(question.id)?.wrongCount || 1,
    }));
    this.setData({ layout: app.globalData.layout, filters: [{ key: 'all', shortName: '全部' }, ...modules], allItems });
    this.applyFilter(this.data.active, events);
  },
  filter(event) {
    const active = event.currentTarget.dataset.key;
    this.applyFilter(active, getApp().globalData.storage.getAnswerEvents());
  },
  applyFilter(active, events) {
    const items = active === 'all' ? this.data.allItems : this.data.allItems.filter(({ moduleKey }) => moduleKey === active);
    const reinforcedCount = getWrongSnapshot(events, new Date(), active === 'all' ? undefined : active).reinforcedIds.length;
    const module = this.data.filters.find(({ key }) => key === active);
    this.setData({
      active, items, wrongCount: items.length, reinforcedCount,
      emptyTitle: active === 'all' ? '暂时还没有错题' : `${module?.name || '该模块'}暂时没有错题`,
      actionText: items.length ? `重新练习 ${items.length} 题` : (active === 'all' ? '去题库开始练习' : `开始${module?.shortName || ''}专项练习`),
    });
  },
  practice() {
    if (this.data.items.length) {
      const questions = this.data.items.map(({ id }) => getQuestionById(id)).filter(Boolean);
      const app = getApp();
      app.globalData.session = createSession(this.data.active === 'all' ? 'mixed' : this.data.active, questions, { autoWrong: true, source: 'wrong' });
      wx.navigateTo({ url: '/pages/question/index' }); return;
    }
    if (this.data.active === 'all') { wx.reLaunch({ url: '/pages/bank/index' }); return; }
    const app = getApp(); app.globalData.practiceMode = 'module'; app.globalData.moduleKey = this.data.active;
    wx.navigateTo({ url: `/pages/practice-setup/index?mode=module&module=${this.data.active}` });
  },
  openItem(event) {
    const question = getQuestionById(event.currentTarget.dataset.id);
    if (!question) return;
    getApp().globalData.session = createSession(question.moduleKey, [question], { autoWrong: true, source: 'wrong' });
    wx.navigateTo({ url: '/pages/question/index' });
  },
});
