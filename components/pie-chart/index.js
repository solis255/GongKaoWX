const COLORS = [
  '#25B889',
  '#4FA7E8',
  '#F2A65A',
  '#8B7FD6',
  '#67C7C2',
  '#E888A7',
  '#A7C957',
  '#6F8FAF',
];

function getPixelRatio() {
  try {
    if (typeof wx.getWindowInfo === 'function') {
      const ratio = Number(wx.getWindowInfo().pixelRatio);
      if (Number.isFinite(ratio) && ratio > 0) return ratio;
    }
  } catch (error) {
    // Continue with the compatible API below.
  }
  try {
    const ratio = Number(wx.getSystemInfoSync().pixelRatio);
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  } catch (error) {
    return 1;
  }
}

Component({
  properties: {
    items: {
      type: Array,
      value: [],
      observer(items) {
        this.prepareItems(items);
      },
    },
  },
  data: {
    chartItems: [],
  },
  lifetimes: {
    ready() {
      this.chartReady = true;
      this.prepareItems(this.data.items);
    },
    detached() {
      this.chartReady = false;
      this.drawVersion = (this.drawVersion || 0) + 1;
    },
  },
  methods: {
    prepareItems(items) {
      const source = Array.isArray(items) ? items : [];
      const chartItems = source
        .filter((item) => (
          item
          && typeof item.name === 'string'
          && Number.isFinite(Number(item.value))
          && Number(item.value) > 0
        ))
        .map((item, index) => ({
          name: item.name,
          value: Number(item.value),
          percent: Number.isFinite(item.percent) ? item.percent : 0,
          color: COLORS[index % COLORS.length],
        }));
      this.setData({ chartItems }, () => this.draw());
    },
    draw() {
      if (!this.chartReady || !this.data.chartItems.length) return;
      const version = (this.drawVersion || 0) + 1;
      this.drawVersion = version;
      this.createSelectorQuery()
        .select('#pieCanvas')
        .fields({ node: true, size: true })
        .exec((result) => {
          if (!this.chartReady || version !== this.drawVersion) return;
          const canvasInfo = result && result[0];
          if (!canvasInfo || !canvasInfo.node || !canvasInfo.width || !canvasInfo.height) return;
          const canvas = canvasInfo.node;
          const context = canvas.getContext('2d');
          if (!context) return;
          const ratio = getPixelRatio();
          canvas.width = Math.round(canvasInfo.width * ratio);
          canvas.height = Math.round(canvasInfo.height * ratio);
          context.scale(ratio, ratio);

          const total = this.data.chartItems.reduce((sum, item) => sum + item.value, 0);
          if (!total) return;
          const centerX = canvasInfo.width / 2;
          const centerY = canvasInfo.height / 2;
          const radius = Math.max(0, Math.min(centerX, centerY) - 2);
          let startAngle = -Math.PI / 2;

          for (const item of this.data.chartItems) {
            const endAngle = startAngle + ((item.value / total) * Math.PI * 2);
            context.beginPath();
            context.moveTo(centerX, centerY);
            context.arc(centerX, centerY, radius, startAngle, endAngle);
            context.closePath();
            context.fillStyle = item.color;
            context.fill();
            startAngle = endAngle;
          }
        });
    },
  },
});
