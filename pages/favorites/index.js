const { getQuestionById, listAllBanks } = require('../../services/question-bank');
const { createSession } = require('../../services/practice-session');

function formatTime(timestamp) {
  if (!timestamp) return '旧版收藏';
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日收藏`;
}

Page({
  data: { items: [] },
  onShow() { this.refresh(); },
  refresh() {
    const storage = getApp().globalData.storage;
    const modules = new Map(listAllBanks().map((item) => [item.key, item]));
    const items = storage.getFavorites()
      .map((record) => ({ record, question: getQuestionById(record.questionId) }))
      .filter(({ question }) => question)
      .sort((a, b) => b.record.favoritedAt - a.record.favoritedAt)
      .map(({ record, question }) => ({ ...question, module: modules.get(question.moduleKey), timeText: formatTime(record.favoritedAt) }));
    this.setData({ items });
  },
  open(event) {
    const question = getQuestionById(event.currentTarget.dataset.id);
    if (!question) return;
    const app = getApp();
    app.globalData.session = createSession(question.moduleKey, [question], { autoWrong: true, source: 'favorites' });
    wx.navigateTo({ url: '/pages/question/index' });
  },
  remove(event) {
    getApp().globalData.storage.toggleFavorite(event.currentTarget.dataset.id);
    this.refresh();
  },
  openBank() { wx.reLaunch({ url: '/pages/bank/index' }); },
});
