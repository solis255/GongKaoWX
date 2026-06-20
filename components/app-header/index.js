const { resolvePositiveMetric } = require('../../services/layout');

Component({
  properties: {
    title: { type: String, value: '' },
    rightText: { type: String, value: '' },
    canBack: { type: Boolean, value: true },
    navHeight: {
      type: Number,
      value: 0,
      observer() {
        this.resolveLayout();
      }
    },
    rightSafeWidth: {
      type: Number,
      value: 0,
      observer() {
        this.resolveLayout();
      }
    }
  },
  data: {
    resolvedNavHeight: 68,
    resolvedRightSafeWidth: 94
  },
  lifetimes: {
    attached() {
      this.resolveLayout();
    }
  },
  methods: {
    resolveLayout() {
      const app = typeof getApp === 'function' ? getApp() : null;
      const layout = app && app.globalData ? app.globalData.layout : null;
      this.setData({
        resolvedNavHeight: resolvePositiveMetric(
          this.properties.navHeight,
          layout && layout.navHeight,
          68
        ),
        resolvedRightSafeWidth: resolvePositiveMetric(
          this.properties.rightSafeWidth,
          layout && layout.rightSafeWidth,
          94
        )
      });
    },
    back() {
      const pages = getCurrentPages();
      if (pages.length > 1) wx.navigateBack();
      else wx.reLaunch({ url: '/pages/home/index' });
    },
    rightTap() { this.triggerEvent('righttap'); }
  }
});
