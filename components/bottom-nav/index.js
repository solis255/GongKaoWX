const ITEMS = [
  { key: 'home', text: '首页', url: '/pages/home/index' },
  { key: 'bank', text: '题库', url: '/pages/bank/index' },
  { key: 'wrong', text: '错题', url: '/pages/wrong/index' },
  { key: 'checkin', text: '打卡', url: '/pages/checkin/index' },
  { key: 'profile', text: '我的', url: '/pages/profile/index' },
];
Component({
  properties: { active: { type: String, value: 'home' } },
  data: { items: ITEMS },
  methods: {
    navigate(event) {
      const { url, key } = event.currentTarget.dataset;
      if (key !== this.data.active) wx.reLaunch({ url });
    }
  }
});
