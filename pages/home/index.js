const { listModules } = require('../../services/question-bank');
const { getGreeting, getDateCard, getModuleProgress, getWrongSnapshot, getTodayCount, getProfileStats } = require('../../services/user-progress');

Page({
  data: { layout: {}, greeting: {}, dateCard: {}, streak: 0, modules: [], wrongCount: 0, todayDone: 0, todayGoal: 20, todayProgress: 0 },
  onShow() {
    this.refresh();
    clearInterval(this.clockTimer);
    this.clockTimer = setInterval(() => this.refresh(), 60000);
  },
  onHide() { clearInterval(this.clockTimer); },
  onUnload() { clearInterval(this.clockTimer); },
  refresh() {
    const app = getApp();
    const storage = app.globalData.storage;
    const now = new Date();
    const events = storage.getAnswerEvents();
    const completed = getModuleProgress(events);
    const snapshot = getWrongSnapshot(events, now);
    const todayDone = getTodayCount(events, now);
    const todayGoal = storage.getDailyGoal();
    const stats = getProfileStats(events, storage.getFavoriteIds(), now);
    const modules = listModules().map((module) => {
      const done = completed[module.key] || 0;
      return { ...module, done, progress: module.questionCount ? Math.round(done / module.questionCount * 100) : 0 };
    });
    this.setData({
      layout: app.globalData.layout,
      greeting: getGreeting(now), dateCard: getDateCard(now), streak: stats.streak,
      modules, wrongCount: snapshot.wrongIds.length,
      todayDone, todayGoal, todayProgress: Math.min(100, Math.round(todayDone / todayGoal * 100)),
    });
  },
  openModule(event) {
    const app = getApp();
    app.globalData.practiceMode = 'module';
    app.globalData.moduleKey = event.currentTarget.dataset.key;
    wx.navigateTo({ url: `/pages/practice-setup/index?mode=module&module=${app.globalData.moduleKey}` });
  },
  continuePractice() {
    const app = getApp();
    const { session } = app.globalData;
    if (session) { wx.navigateTo({ url: session.submitted ? '/pages/analysis/index' : '/pages/question/index' }); return; }
    app.globalData.practiceMode = 'module';
    wx.navigateTo({ url: `/pages/practice-setup/index?mode=module&module=${app.globalData.moduleKey || 'verbal'}` });
  },
  openWrong() { wx.reLaunch({ url: '/pages/wrong/index' }); },
  openGoal() { wx.navigateTo({ url: '/pages/goal/index' }); }
});
