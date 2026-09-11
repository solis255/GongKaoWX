Page({
  data: { items: [] },
  onShow() { this.refresh(); },
  refresh() {
    const items = getApp().globalData.userBankStorage.listTrash().map((item) => ({
      ...item,
      timeText: item.trashedAt ? `${new Date(item.trashedAt).getMonth() + 1}月${new Date(item.trashedAt).getDate()}日删除` : '',
    }));
    this.setData({ items });
  },
  restore(event) {
    getApp().globalData.userBankStorage.restoreBank(event.currentTarget.dataset.id);
    wx.showToast({ title: '题库已恢复', icon: 'success' });
    this.refresh();
  },
  remove(event) {
    const id = event.currentTarget.dataset.id;
    const item = this.data.items.find((bank) => bank.id === id);
    if (!item) return;
    wx.showModal({
      title: '永久删除题库？',
      content: `将永久删除“${item.name}”及其收藏、错题和学习记录，无法撤销。建议先恢复并导出备份。`,
      confirmText: '永久删除',
      confirmColor: '#d95b5b',
      success: ({ confirm }) => {
        if (!confirm) return;
        const app = getApp();
        const questionIds = app.globalData.userBankStorage.getQuestionIds(id);
        app.globalData.userBankStorage.permanentlyDeleteBank(id);
        app.globalData.storage.removeQuestionData(questionIds, id);
        if (app.globalData.session?.moduleKey === id) app.globalData.session = null;
        wx.showToast({ title: '已永久删除', icon: 'none' });
        this.refresh();
      },
    });
  },
});
