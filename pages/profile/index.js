const { getProfileStats, getTodaySubjectDistribution } = require('../../services/user-progress');
const { listUserBanks } = require('../../services/question-bank');

const AVATAR_FILE_PREFIX = 'guokao-profile-avatar-';

function formatLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getAvatarExtension(filePath) {
  const match = typeof filePath === 'string'
    ? filePath.match(/\.([a-zA-Z0-9]+)(?:[?#].*)?$/)
    : null;
  const extension = match ? match[1].toLowerCase() : '';
  return ['jpg', 'jpeg', 'png', 'webp'].includes(extension) ? extension : 'jpg';
}

function runFileOperation(manager, method, options) {
  return new Promise((resolve, reject) => {
    manager[method]({ ...options, success: resolve, fail: reject });
  });
}

async function persistAvatarFile(tempFilePath) {
  const userDataPath = wx.env && wx.env.USER_DATA_PATH;
  const manager = wx.getFileSystemManager && wx.getFileSystemManager();
  if (!tempFilePath || !userDataPath || !manager) throw new Error('avatar file storage is unavailable');
  const filePath = `${userDataPath}/${AVATAR_FILE_PREFIX}${Date.now()}.${getAvatarExtension(tempFilePath)}`;
  if (typeof manager.copyFile === 'function') {
    await runFileOperation(manager, 'copyFile', { srcPath: tempFilePath, destPath: filePath });
  } else if (typeof manager.saveFile === 'function') {
    await runFileOperation(manager, 'saveFile', { tempFilePath, filePath });
  } else {
    throw new Error('avatar file storage is unavailable');
  }
  return filePath;
}

function removeManagedAvatar(filePath) {
  const userDataPath = wx.env && wx.env.USER_DATA_PATH;
  const manager = wx.getFileSystemManager && wx.getFileSystemManager();
  const managedPrefix = userDataPath ? `${userDataPath}/${AVATAR_FILE_PREFIX}` : '';
  if (!manager || typeof manager.unlink !== 'function' || !managedPrefix || !filePath.startsWith(managedPrefix)) {
    return Promise.resolve();
  }
  return runFileOperation(manager, 'unlink', { filePath }).catch(() => undefined);
}

Page({
  data: {
    layout: {},
    total: 0,
    accuracy: 0,
    favorites: 0,
    streak: 0,
    nickname: '备考用户',
    avatarPath: '',
    editing: false,
    saving: false,
    draftNickname: '',
    draftAvatarPath: '',
    avatarChanged: false,
    profileError: '',
    todayDistribution: [],
    todayDistributionTotal: 0,
    examConfigured: false,
    examConfig: { name: '', date: '' },
    examEditing: false,
    examSaving: false,
    draftExamName: '',
    draftExamDate: '',
    examError: '',
    menu: [
      { label: '学习目标', url: '/pages/goal/index' },
      { label: '练习记录', url: '/pages/history/index' },
      { label: '我的收藏', url: '/pages/favorites/index' },
      { label: '内容与反馈', url: '' },
      { label: '关于题库', url: '' },
    ],
  },
  onLoad(options) {
    this.openExamEditorOnShow = Boolean(options && options.editExam === '1');
  },
  onShow() {
    const app = getApp();
    const storage = app.globalData.storage;
    const answerEvents = storage.getAnswerEvents();
    const now = new Date();
    const stats = getProfileStats(answerEvents, storage.getFavoriteIds(), now);
    const todayDistribution = getTodaySubjectDistribution(
      answerEvents,
      listUserBanks({ includeTrash: true }),
      now,
    );
    const examConfig = storage.getExamConfig();
    const nextData = {
      layout: app.globalData.layout,
      ...stats,
      todayDistribution,
      todayDistributionTotal: todayDistribution.reduce((sum, item) => sum + item.value, 0),
      examConfigured: Boolean(examConfig),
      examConfig: examConfig || { name: '', date: '' },
    };
    if (!this.data.editing) Object.assign(nextData, storage.getUserProfile());
    this.setData(nextData, () => {
      if (!this.openExamEditorOnShow) return;
      this.openExamEditorOnShow = false;
      this.startEditExam();
    });
  },
  startEdit() {
    this.setData({
      editing: true,
      examEditing: false,
      draftNickname: this.data.nickname,
      draftAvatarPath: this.data.avatarPath,
      avatarChanged: false,
      profileError: '',
      examError: '',
    });
  },
  cancelEdit() {
    if (this.data.saving) return;
    this.setData({
      editing: false,
      draftNickname: '',
      draftAvatarPath: '',
      avatarChanged: false,
      profileError: '',
    });
  },
  chooseAvatar(event) {
    const avatarPath = event && event.detail && event.detail.avatarUrl;
    if (typeof avatarPath !== 'string' || !avatarPath) {
      this.setData({ profileError: '未能读取所选头像，请重试' });
      return;
    }
    this.setData({ draftAvatarPath: avatarPath, avatarChanged: true, profileError: '' });
  },
  inputNickname(event) {
    this.setData({ draftNickname: event.detail.value, profileError: '' });
  },
  handleAvatarError(event) {
    const scope = event.currentTarget.dataset.scope;
    if (scope === 'draft') {
      this.setData({
        draftAvatarPath: this.data.avatarPath,
        avatarChanged: false,
        profileError: '所选头像无法读取，请重试',
      });
      return;
    }
    try {
      getApp().globalData.storage.saveUserProfile({ nickname: this.data.nickname, avatarPath: '' });
    } catch (error) {
      // The in-memory fallback below still keeps the page usable.
    }
    this.setData({ avatarPath: '' });
  },
  async saveProfile() {
    if (this.data.saving) return;
    const nickname = typeof this.data.draftNickname === 'string'
      ? this.data.draftNickname.trim()
      : '';
    if (!nickname) {
      this.setData({ profileError: '昵称不能为空' });
      return;
    }
    if (Array.from(nickname).length > 20) {
      this.setData({ profileError: '昵称最多 20 个字符' });
      return;
    }

    this.setData({ saving: true, profileError: '' });
    const storage = getApp().globalData.storage;
    const previousAvatarPath = this.data.avatarPath;
    let avatarPath = previousAvatarPath;
    let newAvatarPath = '';
    let avatarSaveFailed = false;

    if (this.data.avatarChanged) {
      try {
        newAvatarPath = await persistAvatarFile(this.data.draftAvatarPath);
        avatarPath = newAvatarPath;
      } catch (error) {
        avatarSaveFailed = true;
      }
    }

    try {
      const profile = storage.saveUserProfile({ nickname, avatarPath });
      this.setData({
        ...profile,
        editing: false,
        saving: false,
        draftNickname: '',
        draftAvatarPath: '',
        avatarChanged: false,
        profileError: '',
      });
      if (newAvatarPath && previousAvatarPath !== newAvatarPath) {
        await removeManagedAvatar(previousAvatarPath);
      }
      wx.showToast({
        title: avatarSaveFailed ? '昵称已保存，头像保存失败' : '资料已保存',
        icon: avatarSaveFailed ? 'none' : 'success',
      });
    } catch (error) {
      if (newAvatarPath) await removeManagedAvatar(newAvatarPath);
      this.setData({ saving: false, profileError: '资料保存失败，请重试' });
    }
  },
  startEditExam() {
    const config = this.data.examConfigured ? this.data.examConfig : null;
    this.setData({
      editing: false,
      draftNickname: '',
      draftAvatarPath: '',
      avatarChanged: false,
      profileError: '',
      examEditing: true,
      draftExamName: config ? config.name : '',
      draftExamDate: config ? config.date : formatLocalDate(),
      examError: '',
    });
  },
  cancelEditExam() {
    if (this.data.examSaving) return;
    this.setData({
      examEditing: false,
      draftExamName: '',
      draftExamDate: '',
      examError: '',
    });
  },
  inputExamName(event) {
    this.setData({ draftExamName: event.detail.value, examError: '' });
  },
  changeExamDate(event) {
    this.setData({ draftExamDate: event.detail.value, examError: '' });
  },
  saveExamConfig() {
    if (this.data.examSaving) return;
    const name = typeof this.data.draftExamName === 'string'
      ? this.data.draftExamName.trim()
      : '';
    if (!name) {
      this.setData({ examError: '考试名称不能为空' });
      return;
    }
    if (Array.from(name).length > 30) {
      this.setData({ examError: '考试名称最多 30 个字符' });
      return;
    }
    if (!this.data.draftExamDate) {
      this.setData({ examError: '请选择考试日期' });
      return;
    }

    this.setData({ examSaving: true, examError: '' });
    try {
      const examConfig = getApp().globalData.storage.saveExamConfig({
        name,
        date: this.data.draftExamDate,
      });
      this.setData({
        examConfigured: true,
        examConfig,
        examEditing: false,
        examSaving: false,
        draftExamName: '',
        draftExamDate: '',
      });
      wx.showToast({ title: '考试设置已保存', icon: 'success' });
    } catch (error) {
      this.setData({ examSaving: false, examError: '请填写有效的考试名称和日期' });
    }
  },
  clearExamConfig() {
    wx.showModal({
      title: '清除考试设置？',
      content: '首页将不再显示本次考试倒计时。',
      confirmText: '清除',
      confirmColor: '#df6464',
      success: ({ confirm }) => {
        if (!confirm) return;
        getApp().globalData.storage.clearExamConfig();
        this.setData({
          examConfigured: false,
          examConfig: { name: '', date: '' },
          examEditing: false,
          examSaving: false,
          draftExamName: '',
          draftExamDate: '',
          examError: '',
        });
        wx.showToast({ title: '考试设置已清除', icon: 'none' });
      },
    });
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
