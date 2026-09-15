const { listAllBanks, listSubjectSummaries } = require('../../services/question-bank');
const {
  getGreeting,
  getDateCard,
  getModuleProgress,
  getWrongSnapshot,
  getTodayCount,
  getProfileStats,
  getExamCountdown,
} = require('../../services/user-progress');

Page({
  data: {
    layout: {},
    greeting: {},
    dateCard: {},
    streak: 0,
    modules: [],
    wrongCount: 0,
    todayDone: 0,
    todayGoal: 20,
    todayProgress: 0,
    examCountdown: {
      configured: false,
      name: '',
      date: '',
      days: null,
      state: 'unset',
      text: '设置考试日期，开始倒计时',
    },
  },
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
    const modules = listSubjectSummaries().map((subject) => {
      const done = subject.bankKeys.reduce((sum, key) => sum + (completed[key] || 0), 0);
      return { ...subject, done, progress: subject.questionCount ? Math.round(done / subject.questionCount * 100) : 0 };
    });
    this.setData({
      layout: app.globalData.layout,
      greeting: getGreeting(now), dateCard: getDateCard(now), streak: stats.streak,
      modules, wrongCount: snapshot.wrongIds.length,
      todayDone, todayGoal, todayProgress: Math.min(100, Math.round(todayDone / todayGoal * 100)),
      examCountdown: getExamCountdown(storage.getExamConfig(), now),
    });
  },
  openSubject(event) {
    const app = getApp();
    const subject = this.data.modules.find(({ key }) => key === event.currentTarget.dataset.key);
    if (!subject?.bankKeys.length) { wx.showToast({ title: '该科目还没有题库', icon: 'none' }); return; }
    app.globalData.practiceMode = 'mixed';
    app.globalData.moduleKey = null;
    app.globalData.mixedModuleKeys = subject.bankKeys;
    app.globalData.practiceTitle = subject.name;
    wx.navigateTo({ url: '/pages/practice-setup/index?mode=mixed' });
  },
  continuePractice() {
    const app = getApp();
    const { session } = app.globalData;
    if (session) { wx.navigateTo({ url: session.submitted ? '/pages/analysis/index' : '/pages/question/index' }); return; }
    const banks = listAllBanks();
    const bank = banks.find(({ key }) => key === app.globalData.moduleKey) || banks[0];
    if (!bank) { wx.reLaunch({ url: '/pages/bank/index' }); return; }
    app.globalData.practiceMode = 'module';
    app.globalData.moduleKey = bank.key;
    wx.navigateTo({ url: `/pages/practice-setup/index?mode=module&module=${bank.key}` });
  },
  openWrong() { wx.reLaunch({ url: '/pages/wrong/index' }); },
  openGoal() { wx.navigateTo({ url: '/pages/goal/index' }); },
  openExamSettings() { wx.reLaunch({ url: '/pages/profile/index?editExam=1' }); },
});
