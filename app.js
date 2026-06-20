const { createStorage } = require('./services/storage');
const { computeLayoutMetrics, getSafeWindowInfo } = require('./services/layout');

App({
  globalData: {
    moduleKey: 'verbal',
    practiceMode: 'module',
    mixedModuleKeys: [],
    session: null,
    storage: null,
    layout: computeLayoutMetrics(),
  },
  onLaunch() {
    this.globalData.storage = createStorage();

    let capsule;
    const windowInfo = getSafeWindowInfo(wx);
    try {
      capsule = wx.getMenuButtonBoundingClientRect();
    } catch (error) {
      capsule = {};
    }
    this.globalData.layout = computeLayoutMetrics(windowInfo, capsule);
  },
});
