Page({
  data: { subjects: [], draft: '' },
  onShow() { this.refresh(); },
  refresh() {
    const app = getApp();
    const counts = new Map();
    for (const bank of app.globalData.userBankStorage.listAllBanks()) {
      counts.set(bank.subjectId, (counts.get(bank.subjectId) || 0) + 1);
    }
    const subjects = app.globalData.subjectStorage.listSubjects().map((subject) => ({
      ...subject,
      shortName: subject.name.slice(0, 2),
      bankCount: counts.get(subject.id) || 0,
    }));
    this.setData({ subjects });
  },
  inputDraft(event) { this.setData({ draft: event.detail.value }); },
  add() {
    try {
      getApp().globalData.subjectStorage.createSubject(this.data.draft);
      this.setData({ draft: '' });
      wx.showToast({ title: '科目已创建', icon: 'success' });
      this.refresh();
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    }
  },
  rename(event) {
    const id = event.currentTarget.dataset.id;
    const subject = this.data.subjects.find((item) => item.id === id);
    if (!subject) return;
    wx.showModal({
      title: '修改科目名称',
      content: subject.name,
      editable: true,
      placeholderText: '请输入科目名称',
      success: ({ confirm, content }) => {
        if (!confirm) return;
        try {
          getApp().globalData.subjectStorage.renameSubject(id, content);
          this.refresh();
        } catch (error) {
          wx.showToast({ title: error.message, icon: 'none' });
        }
      },
    });
  },
  remove(event) {
    const id = event.currentTarget.dataset.id;
    const subject = this.data.subjects.find((item) => item.id === id);
    if (!subject) return;
    if (subject.bankCount) {
      wx.showToast({ title: '请先修改或删除该科目下的题库', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '删除科目？',
      content: `将删除“${subject.name}”，此操作无法撤销。`,
      confirmText: '删除',
      confirmColor: '#d95b5b',
      success: ({ confirm }) => {
        if (!confirm) return;
        const app = getApp();
        const usedIds = app.globalData.userBankStorage.listAllBanks().map((bank) => bank.subjectId);
        try {
          app.globalData.subjectStorage.deleteSubject(id, usedIds);
          this.refresh();
        } catch (error) {
          wx.showToast({ title: error.message, icon: 'none' });
        }
      },
    });
  },
});
