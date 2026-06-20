function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function positiveNumber(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function resolvePositiveMetric(propertyValue, layoutValue, fallback) {
  return positiveNumber(propertyValue, positiveNumber(layoutValue, fallback));
}

function getSafeWindowInfo(wxApi) {
  const safeWx = asObject(wxApi);
  for (const method of ['getWindowInfo', 'getSystemInfoSync']) {
    if (typeof safeWx[method] !== 'function') continue;
    try {
      const info = safeWx[method]();
      if (info && typeof info === 'object' && !Array.isArray(info)) return info;
    } catch (error) {
      // Try the next supported WeChat API.
    }
  }
  return {};
}

function computeLayoutMetrics(windowInfo, capsule) {
  const safeWindowInfo = asObject(windowInfo);
  const safeCapsule = asObject(capsule);
  const statusBarHeight = positiveNumber(safeWindowInfo.statusBarHeight, 20);
  const windowWidth = positiveNumber(
    safeWindowInfo.windowWidth,
    positiveNumber(safeWindowInfo.screenWidth, 375),
  );
  const suppliedTop = positiveNumber(safeCapsule.top, 0);
  const capsuleTop = suppliedTop >= statusBarHeight
    ? suppliedTop
    : statusBarHeight + 8;
  const capsuleHeight = positiveNumber(safeCapsule.height, 32);
  const suppliedLeft = positiveNumber(safeCapsule.left, 0);
  const suppliedRight = positiveNumber(safeCapsule.right, 0);
  const suppliedWidth = positiveNumber(safeCapsule.width, 0);
  const defaultRight = windowWidth - 7;
  const completeGeometry = suppliedLeft && suppliedRight && suppliedWidth;
  const completeGeometryIsValid = completeGeometry
    && suppliedLeft < suppliedRight
    && suppliedRight <= windowWidth
    && Math.abs((suppliedRight - suppliedLeft) - suppliedWidth) <= 1;
  const contradictoryGeometry = completeGeometry && !completeGeometryIsValid;
  const capsuleWidth = contradictoryGeometry
    ? 87
    : suppliedWidth || (suppliedRight > suppliedLeft ? suppliedRight - suppliedLeft : 0) || 87;
  const capsuleRight = contradictoryGeometry
    ? defaultRight
    : suppliedRight && suppliedRight <= windowWidth && suppliedRight > suppliedLeft
      ? suppliedRight
      : suppliedLeft && suppliedLeft + capsuleWidth <= windowWidth
        ? suppliedLeft + capsuleWidth
        : defaultRight;
  const capsuleLeft = contradictoryGeometry
    ? Math.max(0, defaultRight - capsuleWidth)
    : suppliedLeft && suppliedLeft < capsuleRight
      ? suppliedLeft
      : Math.max(0, capsuleRight - capsuleWidth);
  const rightSafeWidth = windowWidth - capsuleLeft;
  const navHeight = Math.max(
    1,
    capsuleTop + capsuleHeight + (capsuleTop - statusBarHeight),
  );

  return {
    statusBarHeight,
    capsuleTop,
    capsuleHeight,
    windowWidth,
    capsuleLeft,
    capsuleRight,
    capsuleWidth,
    rightSafeWidth,
    navHeight,
    contentTop: navHeight + 8,
  };
}

module.exports = {
  computeLayoutMetrics,
  getSafeWindowInfo,
  resolvePositiveMetric,
};
