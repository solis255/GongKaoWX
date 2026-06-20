Page({
  data: { value: 20, options: [10, 20, 30, 50], error: '' },
  onShow() { this.setData({ value: getApp().globalData.storage.getDailyGoal(), error: '' }); },
  choose(event) { this.setData({ value: Number(event.currentTarget.dataset.value), error: '' }); },
  input(event) { this.setData({ value: event.detail.value, error: '' }); },
  save() {
    try {
      getApp().globalData.storage.saveDailyGoal(Number(this.data.value));
      wx.showToast({ title: '目标已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack({ fail: () => wx.reLaunch({ url: '/pages/home/index' }) }), 300);
    } catch (error) {
      this.setData({ error: '请输入 1–200 的整数' });
    }
  },
});
