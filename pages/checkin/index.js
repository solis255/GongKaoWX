const {
  getMonthActivity,
  getProfileStats,
  shiftCalendarMonth,
} = require('../../services/user-progress');

function buildSelectedDay(day, month) {
  if (!day) return null;
  if (day.isFuture) {
    return {
      key: day.key,
      label: `${month}月${day.day}日`,
      state: 'future',
      statusText: '尚未到达',
      detailText: '未来日期暂无学习记录',
    };
  }
  if (day.checked) {
    return {
      key: day.key,
      label: `${month}月${day.day}日`,
      state: 'checked',
      statusText: '已打卡',
      detailText: `当日完成 ${day.count} 题`,
    };
  }
  return {
    key: day.key,
    label: `${month}月${day.day}日`,
    state: 'empty',
    statusText: '未打卡',
    detailText: '当日暂无刷题记录',
  };
}

Page({
  data: {
    weekdays: ['一', '二', '三', '四', '五', '六', '日'],
    monthLabel: '',
    leadingCells: [],
    trailingCells: [],
    calendarDays: [],
    streak: 0,
    checkinDays: 0,
    totalQuestions: 0,
    selected: null,
  },
  onLoad() {
    const now = new Date();
    this.viewYear = now.getFullYear();
    this.viewMonth = now.getMonth() + 1;
    this.selectedKey = '';
  },
  onShow() {
    if (!this.viewYear || !this.viewMonth) {
      const now = new Date();
      this.viewYear = now.getFullYear();
      this.viewMonth = now.getMonth() + 1;
    }
    this.refreshMonth();
  },
  refreshMonth() {
    const storage = getApp().globalData.storage;
    const events = storage.getAnswerEvents();
    const now = new Date();
    const activity = getMonthActivity(events, this.viewYear, this.viewMonth, now);
    if (!activity) return;

    const selectedDay = activity.days.find((day) => day.key === this.selectedKey)
      || activity.days.find((day) => day.isToday)
      || activity.days[0];
    this.selectedKey = selectedDay.key;
    this.setData({
      monthLabel: activity.label,
      leadingCells: Array.from({ length: activity.leadingDays }, (_, index) => index),
      trailingCells: Array.from({ length: activity.trailingDays }, (_, index) => index),
      calendarDays: activity.days,
      streak: getProfileStats(events, [], now).streak,
      checkinDays: activity.checkinDays,
      totalQuestions: activity.totalQuestions,
      selected: buildSelectedDay(selectedDay, activity.month),
    });
  },
  shiftMonth(offset) {
    const next = shiftCalendarMonth(this.viewYear, this.viewMonth, offset);
    if (!next) return;
    this.viewYear = next.year;
    this.viewMonth = next.month;
    this.selectedKey = '';
    this.refreshMonth();
  },
  previousMonth() {
    this.shiftMonth(-1);
  },
  nextMonth() {
    this.shiftMonth(1);
  },
  goToday() {
    const now = new Date();
    this.viewYear = now.getFullYear();
    this.viewMonth = now.getMonth() + 1;
    this.selectedKey = '';
    this.refreshMonth();
  },
  selectDay(event) {
    const key = event.currentTarget.dataset.key;
    const day = this.data.calendarDays.find((item) => item.key === key);
    if (!day) return;
    this.selectedKey = key;
    this.setData({ selected: buildSelectedDay(day, this.viewMonth) });
  },
});
