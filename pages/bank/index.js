const { listAllBanks, listSubjectSummaries } = require('../../services/question-bank');
const { getModuleProgress } = require('../../services/user-progress');
Page({
  data: {
    layout: {}, mode: 'module', modules: [], subjectGroups: [], subjects: [],
    subjectNames: [], selectedKeys: [], trashCount: 0,
  },
  onShow() {
    const app = getApp();
    const completed = getModuleProgress(app.globalData.storage.getAnswerEvents());
    const allBanks = listAllBanks();
    const availableKeys = new Set(allBanks.map(({ key }) => key));
    const retainedKeys = this.data.selectedKeys.filter((key) => availableKeys.has(key));
    const selectedKeys = retainedKeys.length ? retainedKeys : allBanks.map(({ key }) => key);
    const subjects = listSubjectSummaries();
    const subjectIndex = new Map(subjects.map((subject, index) => [subject.key, index]));
    const modules = allBanks.map((item) => {
      const done = completed[item.key] || 0;
      return {
        ...item,
        done,
        progress: item.questionCount ? Math.round(done / item.questionCount * 100) : 0,
        selected: selectedKeys.includes(item.key),
        subjectIndex: subjectIndex.get(item.subjectId) || 0,
      };
    });
    this.setData({
      layout: app.globalData.layout,
      selectedKeys,
      trashCount: app.globalData.userBankStorage.listTrash().length,
      subjects,
      subjectNames: subjects.map(({ name }) => name),
      modules,
      subjectGroups: subjects.map((subject) => ({
        ...subject,
        banks: modules.filter((bank) => bank.subjectId === subject.key),
      })).filter(({ banks }) => banks.length),
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
    app.globalData.practiceTitle = '';
    wx.navigateTo({ url: `/pages/practice-setup/index?mode=module&module=${key}` });
  },
  startRandom() {
    if (!this.data.selectedKeys.length) { wx.showToast({ title: '请先导入题库', icon: 'none' }); return; }
    const app = getApp();
    app.globalData.practiceMode = 'mixed'; app.globalData.moduleKey = null; app.globalData.mixedModuleKeys = this.data.selectedKeys; app.globalData.practiceTitle = '综合随机练习';
    wx.navigateTo({ url: '/pages/practice-setup/index?mode=mixed' });
  },
  importBank() { wx.navigateTo({ url: '/pages/import-bank/index' }); },
  manageSubjects() { wx.navigateTo({ url: '/pages/subjects/index' }); },
  openTrash() { wx.navigateTo({ url: '/pages/bank-trash/index' }); },
  noop() {},
  changeSubject(event) {
    const id = event.currentTarget.dataset.key;
    const subject = this.data.subjects[Number(event.detail.value)];
    if (!subject) return;
    try {
      getApp().globalData.userBankStorage.setBankSubject(id, subject.key);
      this.onShow();
    } catch (error) {
      wx.showToast({ title: '科目修改失败', icon: 'none' });
    }
  },
  trashBank(event) {
    const id = event.currentTarget.dataset.key;
    const bank = this.data.modules.find(({ key }) => key === id);
    if (!bank?.userBank) return;
    wx.showModal({
      title: '移入回收站？',
      content: `“${bank.name}”将从题库列表隐藏，学习记录暂时保留。`,
      confirmText: '移入',
      success: ({ confirm }) => {
        if (!confirm) return;
        const app = getApp();
        app.globalData.userBankStorage.trashBank(id);
        if (app.globalData.session?.moduleKey === id) app.globalData.session = null;
        this.onShow();
      },
    });
  },
  exportBank(event) {
    const id = event.currentTarget.dataset.key;
    const bank = this.data.modules.find(({ key }) => key === id);
    if (!bank?.userBank) return;
    try {
      const data = getApp().globalData.userBankStorage.exportBank(id, { subjectName: bank.subjectName });
      const fs = wx.getFileSystemManager();
      const directory = `${wx.env.USER_DATA_PATH}/guokao-exports`;
      try { fs.accessSync(directory); } catch (error) { fs.mkdirSync(directory, true); }
      const safeName = bank.name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40) || '私人题库';
      const filePath = `${directory}/${safeName}_${Date.now()}.json`;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      if (typeof wx.shareFileMessage !== 'function') {
        wx.showModal({ title: '导出文件已生成', content: '当前微信版本不支持分享文件，请升级微信后重试。', showCancel: false });
        return;
      }
      wx.shareFileMessage({
        filePath,
        fileName: `${safeName}.json`,
        fail: () => wx.showToast({ title: '导出未完成', icon: 'none' }),
      });
    } catch (error) {
      wx.showToast({ title: '导出失败', icon: 'none' });
    }
  },
});
