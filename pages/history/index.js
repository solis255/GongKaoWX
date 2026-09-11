const { getHistoryRows } = require('../../services/user-progress');
const { getQuestionById, listAllBanks } = require('../../services/question-bank');
const { createSession } = require('../../services/practice-session');

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

Page({
  data: { items: [] },
  onShow() {
    const modules = new Map(listAllBanks().map((item) => [item.key, item]));
    const items = getHistoryRows(getApp().globalData.storage.getAnswerEvents())
      .map((row) => ({ row, question: getQuestionById(row.questionId) }))
      .filter(({ question }) => question)
      .map(({ row, question }) => ({ ...row, question, module: modules.get(question.moduleKey), timeText: formatTime(row.lastAnsweredAt) }));
    this.setData({ items });
  },
  open(event) {
    const question = getQuestionById(event.currentTarget.dataset.id);
    if (!question) return;
    const app = getApp();
    app.globalData.session = createSession(question.moduleKey, [question], { autoWrong: true, source: 'history' });
    wx.navigateTo({ url: '/pages/question/index' });
  },
  openBank() { wx.reLaunch({ url: '/pages/bank/index' }); },
});
