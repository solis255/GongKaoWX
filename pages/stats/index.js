const { listModules } = require('../../services/question-bank');
const { getProfileStats } = require('../../services/user-progress');
Page({
  data: {
    total: 0,
    weekTotal: 0,
    accuracy: 0,
    streak: 0,
    bars: [],
    modules: []
  },
  onShow() {
    const storage = getApp().globalData.storage;
    const events = storage.getAnswerEvents();
    const stats = getProfileStats(events, storage.getFavoriteIds(), new Date());
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const labels = ['一', '二', '三', '四', '五', '六', '日'];
    const counts = labels.map((day, index) => {
      const start = new Date(monday); start.setDate(start.getDate() + index);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      return { day, count: events.filter(({ answeredAt }) => answeredAt >= start.getTime() && answeredAt < end.getTime()).length, today: start.toDateString() === now.toDateString() };
    });
    const max = Math.max(1, ...counts.map(({ count }) => count));
    const modules = listModules().map((module) => {
      const scoped = events.filter(({ moduleKey }) => moduleKey === module.key);
      const correct = scoped.filter(({ correct }) => correct).length;
      return { ...module, score: scoped.length ? Math.round(correct / scoped.length * 100) : 0 };
    });
    this.setData({ total: stats.total, weekTotal: counts.reduce((sum, item) => sum + item.count, 0), accuracy: stats.accuracy, streak: stats.streak, bars: counts.map((item) => ({ ...item, value: Math.round(item.count / max * 100) })), modules });
  }
});
