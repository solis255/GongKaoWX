const { getProfileStats } = require('../../services/user-progress');

Page({
  data: { layout: {}, total: 0, accuracy: 0, favorites: 0, streak: 0, menu: [
    { label: '学习目标', url: '/pages/goal/index' },
    { label: '练习记录', url: '/pages/history/index' },
    { label: '我的收藏', url: '/pages/favorites/index' },
    { label: '内容与反馈', url: '' },
    { label: '关于题库', url: '' },
  ] },
  onShow() {
    const app = getApp();
    const storage = app.globalData.storage;
    const stats = getProfileStats(storage.getAnswerEvents(), storage.getFavoriteIds(), new Date());
    this.setData({ layout: app.globalData.layout, ...stats });
  },
  openMenu(event) {
    const item = this.data.menu[event.currentTarget.dataset.index];
    if (item.url) wx.navigateTo({ url: item.url });
    else wx.showToast({ title: '功能建设中', icon: 'none' });
  },
  openTotal() { wx.navigateTo({ url: '/pages/history/index' }); },
  openAccuracy() { wx.navigateTo({ url: '/pages/stats/index' }); },
  openFavorites() { wx.navigateTo({ url: '/pages/favorites/index' }); },
});
