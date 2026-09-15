function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isAnswerEvent(event) {
  return Boolean(
    event
    && typeof event.questionId === 'string'
    && event.questionId.trim().length > 0
    && typeof event.moduleKey === 'string'
    && event.moduleKey.trim().length > 0
    && typeof event.correct === 'boolean'
    && Number.isFinite(event.answeredAt)
    && Number.isFinite(new Date(event.answeredAt).getTime()),
  );
}

function validEvents(events) {
  return asArray(events).filter(isAnswerEvent);
}

function isValidDate(date) {
  return date instanceof Date && Number.isFinite(date.getTime());
}

function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return { title: '夜深了', subtitle: '注意休息' };
  if (hour < 12) return { title: '早上好', subtitle: '继续保持' };
  if (hour < 14) return { title: '中午好', subtitle: '稳步前进' };
  if (hour < 19) return { title: '下午好', subtitle: '保持专注' };
  return { title: '晚上好', subtitle: '今天也有收获' };
}

function getDateCard(date = new Date()) {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return {
    month: date.getMonth() + 1,
    day: date.getDate(),
    weekday: weekdays[date.getDay()],
  };
}

function getModuleProgress(events) {
  const answeredCorrectly = new Map();
  for (const event of validEvents(events)) {
    if (!answeredCorrectly.has(event.moduleKey)) {
      answeredCorrectly.set(event.moduleKey, new Set());
    }
    if (event.correct) answeredCorrectly.get(event.moduleKey).add(event.questionId);
  }
  return Object.fromEntries(
    [...answeredCorrectly].map(([moduleKey, questionIds]) => [moduleKey, questionIds.size]),
  );
}

function latestByQuestion(events) {
  const latest = new Map();
  for (const event of events) latest.set(event.questionId, event);
  return latest;
}

function startOfWeek(now) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start.getTime();
}

function getWrongSnapshot(events, now = new Date(), moduleKey) {
  if (!isValidDate(now)) return { wrongIds: [], reinforcedIds: [] };
  const nowTime = now.getTime();
  const source = validEvents(events)
    .filter((event) => event.answeredAt <= nowTime)
    .filter((event) => !moduleKey || event.moduleKey === moduleKey)
    .slice()
    .sort((a, b) => a.answeredAt - b.answeredAt);
  const latest = latestByQuestion(source);
  const everWrong = new Set();
  const reinforced = new Set();
  const weekStart = startOfWeek(now);

  for (const event of source) {
    if (!event.correct) everWrong.add(event.questionId);
    if (
      event.correct
      && event.answeredAt >= weekStart
      && event.answeredAt <= nowTime
      && everWrong.has(event.questionId)
    ) {
      reinforced.add(event.questionId);
    }
  }

  return {
    wrongIds: [...latest.values()]
      .filter((event) => !event.correct)
      .map((event) => event.questionId),
    reinforcedIds: [...reinforced],
  };
}

function dayKey(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function calendarDayStamp(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatCalendarDay(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getDailyActivity(events, now = new Date()) {
  if (!isValidDate(now)) return {};
  const todayStamp = calendarDayStamp(now);
  const counts = {};
  for (const event of validEvents(events)) {
    const answeredDate = new Date(event.answeredAt);
    if (calendarDayStamp(answeredDate) > todayStamp) continue;
    const key = formatCalendarDay(
      answeredDate.getFullYear(),
      answeredDate.getMonth() + 1,
      answeredDate.getDate(),
    );
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function getMonthActivity(events, year, month, now = new Date()) {
  const validMonth = Number.isInteger(year) && year >= 1900
    && Number.isInteger(month) && month >= 1 && month <= 12;
  if (!validMonth || !isValidDate(now)) return null;

  const counts = getDailyActivity(events, now);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingDays = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const todayKey = formatCalendarDay(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const todayStamp = calendarDayStamp(now);
  let checkinDays = 0;
  let totalQuestions = 0;

  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const key = formatCalendarDay(year, month, day);
    const future = Date.UTC(year, month - 1, day) > todayStamp;
    const count = future ? 0 : (counts[key] || 0);
    const checked = count > 0;
    if (checked) checkinDays += 1;
    totalQuestions += count;
    return {
      key,
      day,
      count,
      checked,
      isToday: key === todayKey,
      isFuture: future,
    };
  });

  return {
    year,
    month,
    label: `${year}年${month}月`,
    leadingDays,
    trailingDays: (7 - ((leadingDays + daysInMonth) % 7)) % 7,
    checkinDays,
    totalQuestions,
    days,
  };
}

function shiftCalendarMonth(year, month, offset) {
  if (
    !Number.isInteger(year)
    || year < 1900
    || !Number.isInteger(month)
    || month < 1
    || month > 12
    || !Number.isInteger(offset)
  ) return null;
  const monthIndex = (year * 12) + month - 1 + offset;
  const nextYear = Math.floor(monthIndex / 12);
  if (nextYear < 1900) return null;
  return {
    year: nextYear,
    month: ((monthIndex % 12) + 12) % 12 + 1,
  };
}

function getTodayCount(events, now = new Date()) {
  if (!isValidDate(now)) return 0;
  const today = dayKey(now.getTime());
  return validEvents(events).filter((event) => dayKey(event.answeredAt) === today).length;
}

function getTodaySubjectDistribution(events, banks, now = new Date()) {
  if (!isValidDate(now)) return [];
  const subjectByModule = new Map();
  for (const bank of asArray(banks)) {
    if (!bank || typeof bank.key !== 'string' || !bank.key.trim()) continue;
    const subjectName = typeof bank.subjectName === 'string' ? bank.subjectName.trim() : '';
    subjectByModule.set(bank.key, subjectName || '其他');
  }

  const today = dayKey(now.getTime());
  const counts = new Map();
  for (const event of validEvents(events)) {
    if (dayKey(event.answeredAt) !== today) continue;
    const subjectName = subjectByModule.get(event.moduleKey) || '其他';
    counts.set(subjectName, (counts.get(subjectName) || 0) + 1);
  }

  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  return [...counts.entries()]
    .map(([name, value], index) => ({
      name,
      value,
      percent: Math.round((value / total) * 100),
      order: index,
    }))
    .sort((left, right) => right.value - left.value || left.order - right.order)
    .map(({ name, value, percent }) => ({ name, value, percent }));
}

function parseExamDate(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || month < 1 || month > 12) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= monthDays[month - 1] ? { year, month, day } : null;
}

function getExamCountdown(config, now = new Date()) {
  const name = config && typeof config.name === 'string' ? config.name.trim() : '';
  const date = config && typeof config.date === 'string' ? config.date.trim() : '';
  const target = parseExamDate(date);
  const unset = {
    configured: false,
    name: '',
    date: '',
    days: null,
    state: 'unset',
    text: '设置考试日期，开始倒计时',
  };
  if (!isValidDate(now) || !name || Array.from(name).length > 30 || !target) return unset;

  const targetDay = Date.UTC(target.year, target.month - 1, target.day);
  const currentDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const difference = Math.round((targetDay - currentDay) / 86400000);
  if (difference > 0) {
    return {
      configured: true,
      name,
      date,
      days: difference,
      state: 'future',
      text: `距离考试还有 ${difference} 天`,
    };
  }
  if (difference === 0) {
    return {
      configured: true,
      name,
      date,
      days: 0,
      state: 'today',
      text: '考试就在今天',
    };
  }
  const elapsed = Math.abs(difference);
  return {
    configured: true,
    name,
    date,
    days: elapsed,
    state: 'past',
    text: `考试已结束 ${elapsed} 天`,
  };
}

function getProfileStats(events, favoriteIds, now = new Date()) {
  const source = validEvents(events);
  const studiedDays = new Set(source.map((event) => dayKey(event.answeredAt)));
  let streak = 0;
  const cursor = isValidDate(now)
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
    : null;
  if (cursor && !studiedDays.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);

  while (cursor && studiedDays.has(dayKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const correct = source.filter((event) => event.correct).length;
  return {
    total: source.length,
    correct,
    accuracy: source.length ? Math.round((correct / source.length) * 100) : 0,
    favorites: asArray(favoriteIds).length,
    streak,
  };
}

function getHistoryRows(events) {
  const rows = new Map();
  for (const event of validEvents(events)) {
    const row = rows.get(event.questionId) || {
      questionId: event.questionId,
      moduleKey: event.moduleKey,
      attemptCount: 0,
      wrongCount: 0,
    };
    row.attemptCount += 1;
    if (!event.correct) row.wrongCount += 1;
    if (row.lastAnsweredAt === undefined || event.answeredAt >= row.lastAnsweredAt) {
      row.lastAnsweredAt = event.answeredAt;
      row.latestCorrect = Boolean(event.correct);
    }
    rows.set(event.questionId, row);
  }
  return [...rows.values()].sort((a, b) => b.lastAnsweredAt - a.lastAnsweredAt);
}

module.exports = {
  getGreeting,
  getDateCard,
  getModuleProgress,
  getWrongSnapshot,
  getProfileStats,
  getHistoryRows,
  getTodayCount,
  getTodaySubjectDistribution,
  getExamCountdown,
  getDailyActivity,
  getMonthActivity,
  shiftCalendarMonth,
};
