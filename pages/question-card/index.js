const { buildQuestionCard, jumpToQuestion } = require('../../services/practice-session');

Page({
  data: { rows: [], completed: 0, correct: 0, wrong: 0 },
  onShow() {
    const session = getApp().globalData.session;
    if (!session) { wx.reLaunch({ url: '/pages/home/index' }); return; }
    const rows = buildQuestionCard(session);
    this.setData({
      rows,
      completed: session.answers.length,
      correct: session.answers.filter((item) => item.correct).length,
      wrong: session.answers.filter((item) => !item.correct).length,
    });
  },
  openQuestion(event) {
    const index = Number(event.currentTarget.dataset.index);
    const row = this.data.rows[index];
    if (!row || row.locked) {
      wx.showToast({ title: '请按顺序完成前面的题目', icon: 'none' });
      return;
    }
    const app = getApp();
    app.globalData.session = jumpToQuestion(app.globalData.session, index);
    wx.redirectTo({ url: app.globalData.session.submitted ? '/pages/analysis/index' : '/pages/question/index' });
  },
});
