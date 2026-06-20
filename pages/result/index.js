const { summarizeSession } = require('../../services/practice-session');
const { listModules } = require('../../services/question-bank');
Page({
  data: { layout: {}, summary: null, module: null, minutes: 0, seconds: 0, averageSeconds: 0, streak: 0 },
  onLoad() {
    const app = getApp();
    const session = app.globalData.session;
    if (!session) { wx.reLaunch({ url: '/pages/home/index' }); return; }
    const summary = summarizeSession(session);
    const module = listModules().find(({ key }) => key === session.moduleKey) || { name: '综合随机练习' };
    app.globalData.storage.savePractice({ moduleKey: session.moduleKey, ...summary });
    this.setData({
      layout: app.globalData.layout,
      summary,
      module,
      minutes: Math.floor(summary.elapsedMs / 60000),
      seconds: Math.floor((summary.elapsedMs % 60000) / 1000),
      averageSeconds: summary.total ? Math.round(summary.elapsedMs / summary.total / 1000) : 0,
      streak: Math.min(summary.correct, 6)
    });
  },
  reviewWrong() { wx.reLaunch({ url: '/pages/wrong/index' }); },
  again() {
    const app = getApp();
    const session = app.globalData.session;
    const mixed = session.settings?.mode === 'mixed';
    const moduleKey = session.questions[0]?.moduleKey || session.moduleKey || 'verbal';
    app.globalData.practiceMode = mixed ? 'mixed' : 'module';
    app.globalData.moduleKey = mixed ? null : moduleKey;
    wx.redirectTo({ url: mixed ? '/pages/practice-setup/index?mode=mixed' : `/pages/practice-setup/index?mode=module&module=${moduleKey}` });
  },
  home() { getApp().globalData.session = null; wx.reLaunch({ url: '/pages/home/index' }); }
});
