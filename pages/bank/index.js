const { listModules } = require('../../services/question-bank');
const { getModuleProgress } = require('../../services/user-progress');
Page({
  data: { layout: {}, mode: 'module', modules: [], selectedKeys: [] },
  onShow() {
    const app = getApp();
    const completed = getModuleProgress(app.globalData.storage.getAnswerEvents());
    const selectedKeys = this.data.selectedKeys.length ? this.data.selectedKeys : listModules().map(({ key }) => key);
    this.setData({
      layout: app.globalData.layout,
      selectedKeys,
      modules: listModules().map((item) => {
        const done = completed[item.key] || 0;
        return { ...item, done, progress: item.questionCount ? Math.round(done / item.questionCount * 100) : 0, selected: selectedKeys.includes(item.key) };
      }),
    });
  },
  changeMode(event) { this.setData({ mode: event.currentTarget.dataset.mode }); this.onShow(); },
  openModule(event) {
    const key = event.currentTarget.dataset.key;
    if (this.data.mode === 'random') {
      const selectedKeys = this.data.selectedKeys.includes(key)
        ? this.data.selectedKeys.filter((item) => item !== key)
        : [...this.data.selectedKeys, key];
      if (!selectedKeys.length) { wx.showToast({ title: '至少选择一个模块', icon: 'none' }); return; }
      this.setData({ selectedKeys }); this.onShow(); return;
    }
    const app = getApp(); app.globalData.practiceMode = 'module'; app.globalData.moduleKey = key;
    wx.navigateTo({ url: `/pages/practice-setup/index?mode=module&module=${key}` });
  },
  startRandom() {
    const app = getApp();
    app.globalData.practiceMode = 'mixed'; app.globalData.moduleKey = null; app.globalData.mixedModuleKeys = this.data.selectedKeys;
    wx.navigateTo({ url: '/pages/practice-setup/index?mode=mixed' });
  },
});
