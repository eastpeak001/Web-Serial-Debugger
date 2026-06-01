const baudRateSelect = document.getElementById("baudRate");
const connectionModeSelect = document.getElementById("connectionMode");
const bleConfigRow = document.getElementById("bleConfigRow");
const bleServiceUuidInput = document.getElementById("bleServiceUuid");
const bleTxUuidInput = document.getElementById("bleTxUuid");
const bleRxUuidInput = document.getElementById("bleRxUuid");
const connectButton = document.getElementById("connectButton");
const disconnectButton = document.getElementById("disconnectButton");
const clearButton = document.getElementById("clearButton");
const saveLogButton = document.getElementById("saveLogButton");
const copyLogButton = document.getElementById("copyLogButton");
const resetSettingsButton = document.getElementById("resetSettingsButton");
const hexDisplayCheckbox = document.getElementById("hexDisplay");
const pauseReceiveDisplayCheckbox = document.getElementById("pauseReceiveDisplay");
const autoScrollCheckbox = document.getElementById("autoScroll");
const showTimestampCheckbox = document.getElementById("showTimestamp");
const searchInput = document.getElementById("searchInput");
const clearSearchButton = document.getElementById("clearSearchButton");
const quickSearchButtons = document.querySelectorAll(".quick-search-button");
const showOnlyMatchesCheckbox = document.getElementById("showOnlyMatches");
const searchMatchCount = document.getElementById("searchMatchCount");
const maxLogLinesSelect = document.getElementById("maxLogLines");
const totalLineCount = document.getElementById("totalLineCount");
const matchedLineCount = document.getElementById("matchedLineCount");
const receiveByteCount = document.getElementById("receiveByteCount");
const sendCountDisplay = document.getElementById("sendCount");
const receiveArea = document.getElementById("receiveArea");
const plotterEnabledCheckbox = document.getElementById("plotterEnabled");
const plotterVariablesInput = document.getElementById("plotterVariables");
const plotterScaleModeSelect = document.getElementById("plotterScaleMode");
const applyPlotterVariablesButton = document.getElementById("applyPlotterVariablesButton");
const clearPlotterButton = document.getElementById("clearPlotterButton");
const resetPlotterZoomButton = document.getElementById("resetPlotterZoomButton");
const togglePlotterViewButton = document.getElementById("togglePlotterViewButton");
const plotterLegend = document.getElementById("plotterLegend");
const plotterCanvasWrap = document.getElementById("plotterCanvasWrap");
const plotterCanvas = document.getElementById("plotterCanvas");
const plotterTooltip = document.getElementById("plotterTooltip");
const quickCommandButtons = document.getElementById("quickCommandButtons");
const quickCommandInput = document.getElementById("quickCommandInput");
const applyQuickCommandsButton = document.getElementById("applyQuickCommandsButton");
const sendInput = document.getElementById("sendInput");
const sendHistorySelect = document.getElementById("sendHistory");
const clearHistoryButton = document.getElementById("clearHistoryButton");
const sendEndingSelect = document.getElementById("sendEnding");
const hexSendCheckbox = document.getElementById("hexSend");
const multiLineSendCheckbox = document.getElementById("multiLineSend");
const confirmBeforeSendCheckbox = document.getElementById("confirmBeforeSend");
const sendButton = document.getElementById("sendButton");
const supportMessage = document.getElementById("supportMessage");
const statusBar = document.getElementById("statusBar");
const copyDeviceInfoButton = document.getElementById("copyDeviceInfoButton");

const SETTINGS_STORAGE_KEY = "webSerialDebugger.settings.v1";
const SEND_HISTORY_STORAGE_KEY = "webSerialDebugger.sendHistory.v1";
const QUICK_COMMANDS_STORAGE_KEY = "webSerialDebugger.quickCommands.v1";
const MAX_SEND_HISTORY = 20;
const MAX_PLOT_POINTS = 200;
const DEFAULT_QUICK_COMMANDS = ["h", "help", "status", "reset", "version"];
const DEFAULT_PLOTTER_VARIABLES = "CO2,T,RH,RMS";
const DEFAULT_BLE_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const DEFAULT_BLE_TX_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
const DEFAULT_BLE_RX_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const PLOT_COLORS = ["#007aff", "#34c759", "#ff9500", "#ff3b30", "#af52de", "#00a6d6", "#5856d6", "#ff2d55"];
const PLOT_COLOR_BY_VARIABLE = {
  co2: "#007aff",
  filtered: "#34c759",
  t: "#ff9500",
  rh: "#ff3b30",
};
const DEFAULT_SETTINGS = {
  baudRate: "115200",
  sendEnding: "crlf",
  hexDisplay: false,
  hexSend: false,
  multiLineSend: false,
  autoScroll: true,
  showTimestamp: true,
  pauseReceiveDisplay: false,
  maxLogLines: "1000",
  confirmBeforeSend: false,
  plotterEnabled: false,
  plotterVariables: DEFAULT_PLOTTER_VARIABLES,
  plotterScaleMode: "global",
  plotterVisible: true,
  bleServiceUuid: DEFAULT_BLE_SERVICE_UUID,
  bleTxUuid: DEFAULT_BLE_TX_UUID,
  bleRxUuid: DEFAULT_BLE_RX_UUID,
};

let port = null;
let reader = null;
let writer = null;
let bleDevice = null;
let bleServer = null;
let bleService = null;
let bleNotifyCharacteristic = null;
let bleWriteCharacteristic = null;
let bleTextDecoder = new TextDecoder();
let bleLineBuffer = "";
let bleDisconnectExpected = false;
let keepReading = false;
let readLoopPromise = null;
let receiveLineBuffer = "";
let logLines = [];
let receiveBytes = 0;
let sendCount = 0;
let sendHistory = [];
let quickCommands = [...DEFAULT_QUICK_COMMANDS];
let plotterVariables = [];
let plotterData = {};
let plotterZoomPointCount = null;
let plotterHoverIndex = null;
let plotterHoverClientPosition = null;
let currentDeviceInfo = null;
let previousConnectionMode = connectionModeSelect.value;

function appendDisplayLine(text) {
  logLines.push(formatDisplayLine(text));
  trimLogLinesToLimit();
  renderReceiveArea();
}

function formatDisplayLine(text) {
  if (!showTimestampCheckbox.checked) {
    return text;
  }

  return `${getCurrentTimeText()} ${text}`;
}

function renderReceiveArea() {
  const visibleLines = getVisibleLogLines();
  receiveArea.textContent = visibleLines.length > 0 ? `${visibleLines.join("\n")}\n` : "";
  updateSearchMatchCount();
  updateStatsBar();
  scrollReceiveAreaIfNeeded();
}

function getVisibleLogLines() {
  const keyword = getSearchKeyword();
  if (!keyword || !showOnlyMatchesCheckbox.checked) {
    return logLines;
  }

  return getMatchedLogLines(keyword);
}

function getMatchedLogLines(keyword) {
  return logLines.filter((line) => line.toLowerCase().includes(keyword));
}

function getSearchKeyword() {
  return searchInput.value.trim().toLowerCase();
}

function getMaxLogLineCount() {
  if (maxLogLinesSelect.value === "unlimited") {
    return Infinity;
  }

  return Number(maxLogLinesSelect.value);
}

function trimLogLinesToLimit() {
  const maxLogLines = getMaxLogLineCount();
  if (Number.isFinite(maxLogLines) && logLines.length > maxLogLines) {
    logLines = logLines.slice(-maxLogLines);
  }
}

function parsePlotterVariables(text) {
  return text
    .split(",")
    .map((variable) => variable.trim())
    .filter((variable) => variable.length > 0);
}

function normalizePlotterVariables(text) {
  const variables = parsePlotterVariables(text);
  return variables.length > 0 ? variables.join(",") : DEFAULT_PLOTTER_VARIABLES;
}

function applyPlotterVariables() {
  plotterVariablesInput.value = normalizePlotterVariables(plotterVariablesInput.value);
  plotterVariables = parsePlotterVariables(plotterVariablesInput.value);
  plotterVariables.forEach((variable) => {
    if (!plotterData[variable]) {
      plotterData[variable] = [];
    }
  });
  drawPlotter();
}

function clearPlotterData() {
  plotterData = {};
  plotterVariables.forEach((variable) => {
    plotterData[variable] = [];
  });
  resetPlotterZoom();
  drawPlotter();
}

function getMaxPlotterPointCount() {
  return Math.max(0, ...plotterVariables.map((variable) => (plotterData[variable] || []).length));
}

function getVisiblePlotterPointCount() {
  const maxPointCount = getMaxPlotterPointCount();
  if (maxPointCount === 0) {
    return 0;
  }

  return Math.min(plotterZoomPointCount ?? maxPointCount, maxPointCount);
}

function resetPlotterZoom() {
  plotterZoomPointCount = null;
  plotterHoverIndex = null;
  plotterHoverClientPosition = null;
  hidePlotterTooltip();
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findPlotterValue(line, variable) {
  const escapedVariable = escapeRegExp(variable);
  const numberPattern = "(-?\\d+(?:\\.\\d+)?)";
  const patterns = [
    new RegExp(`\\b${escapedVariable}\\b\\s+raw\\s*[=:]?\\s*${numberPattern}`, "i"),
    new RegExp(`\\b${escapedVariable}\\s*raw\\b\\s*[=:]?\\s*${numberPattern}`, "i"),
    new RegExp(`\\b${escapedVariable}\\b\\s*[=:]\\s*${numberPattern}`, "i"),
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (!match) {
      continue;
    }

    const value = Number(match[1]);
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function appendPlotterValue(variable, value) {
  if (!plotterData[variable]) {
    plotterData[variable] = [];
  }
  plotterData[variable].push(value);
  if (plotterData[variable].length > MAX_PLOT_POINTS) {
    plotterData[variable] = plotterData[variable].slice(-MAX_PLOT_POINTS);
  }
}

function getPlotterRange(points) {
  if (points.length === 0) {
    return { min: null, max: null };
  }

  return {
    min: Math.min(...points),
    max: Math.max(...points),
  };
}

function updatePlotterLegend() {
  plotterLegend.innerHTML = "";

  plotterVariables.forEach((variable, variableIndex) => {
    const points = plotterData[variable] || [];
    const latestValue = points.length > 0 ? points[points.length - 1] : "--";
    const range = getPlotterRange(points);
    const rangeText = range.min === null ? "" : ` (min ${range.min} / max ${range.max})`;
    const item = document.createElement("span");
    item.className = "plotter-legend-item";
    item.style.color = getPlotterColor(variable, variableIndex);
    item.textContent = `${variable}: ${latestValue}${rangeText}`;
    plotterLegend.appendChild(item);
  });
}

function getPlotterColor(variable, variableIndex) {
  return PLOT_COLOR_BY_VARIABLE[variable.toLowerCase()] || PLOT_COLORS[variableIndex % PLOT_COLORS.length];
}

function getVisiblePlotterPoints(variable, visiblePointCount) {
  const points = plotterData[variable] || [];
  return points.slice(-visiblePointCount);
}

function getPlotterPointX(pointIndex, pointCount, plotLeft, plotWidth) {
  if (pointCount <= 1) {
    return plotLeft + plotWidth / 2;
  }

  return plotLeft + (plotWidth * pointIndex) / (pointCount - 1);
}

function updatePlotterVisibility() {
  const isVisible = !plotterCanvasWrap.classList.contains("plotter-hidden");
  plotterLegend.hidden = !isVisible;
  plotterCanvasWrap.hidden = !isVisible;
  togglePlotterViewButton.textContent = isVisible ? "隐藏曲线模块" : "显示曲线模块";
  if (isVisible) {
    drawPlotter();
  } else {
    hidePlotterTooltip();
  }
}

function setPlotterVisible(isVisible) {
  plotterCanvasWrap.classList.toggle("plotter-hidden", !isVisible);
  updatePlotterVisibility();
}

function hidePlotterTooltip() {
  plotterTooltip.hidden = true;
}

function updatePlotterTooltip(items, event) {
  if (items.length === 0) {
    hidePlotterTooltip();
    return;
  }

  plotterTooltip.innerHTML = "";
  items.forEach((item) => {
    const line = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = item.variable;
    line.appendChild(name);
    line.append(` #${item.index}: ${item.value}`);
    plotterTooltip.appendChild(line);
  });
  plotterTooltip.hidden = false;

  const wrapRect = plotterCanvasWrap.getBoundingClientRect();
  const left = Math.min(event.clientX - wrapRect.left + 12, wrapRect.width - 170);
  const top = Math.max(8, event.clientY - wrapRect.top + 12);
  plotterTooltip.style.left = `${Math.max(8, left)}px`;
  plotterTooltip.style.top = `${top}px`;
}

function handlePlotterMouseMove(event) {
  const visiblePointCount = getVisiblePlotterPointCount();
  if (visiblePointCount === 0) {
    plotterHoverIndex = null;
    hidePlotterTooltip();
    drawPlotter();
    return;
  }

  const rect = plotterCanvas.getBoundingClientRect();
  const plotLeft = 14;
  const plotRight = rect.width - 14;
  const plotWidth = plotRight - plotLeft;
  const relativeX = Math.min(Math.max(event.clientX - rect.left, plotLeft), plotRight);
  plotterHoverIndex = visiblePointCount <= 1 ? 0 : Math.round(((relativeX - plotLeft) / plotWidth) * (visiblePointCount - 1));
  plotterHoverClientPosition = { x: event.clientX, y: event.clientY };

  const items = [];
  plotterVariables.forEach((variable) => {
    const allPoints = plotterData[variable] || [];
    const visiblePoints = getVisiblePlotterPoints(variable, visiblePointCount);
    const offset = visiblePointCount - visiblePoints.length;
    const localIndex = plotterHoverIndex - offset;
    if (localIndex < 0 || localIndex >= visiblePoints.length) {
      return;
    }

    items.push({
      variable,
      index: allPoints.length - visiblePoints.length + localIndex + 1,
      value: visiblePoints[localIndex],
    });
  });

  updatePlotterTooltip(items, event);
  drawPlotter();
}

function handlePlotterMouseLeave() {
  plotterHoverIndex = null;
  plotterHoverClientPosition = null;
  hidePlotterTooltip();
  drawPlotter();
}

function handlePlotterWheel(event) {
  const maxPointCount = getMaxPlotterPointCount();
  if (maxPointCount === 0) {
    return;
  }

  event.preventDefault();
  const currentCount = getVisiblePlotterPointCount() || maxPointCount;
  const step = Math.max(5, Math.round(currentCount * 0.2));
  const minCount = Math.min(10, maxPointCount);
  const nextCount = event.deltaY < 0
    ? Math.max(minCount, currentCount - step)
    : Math.min(maxPointCount, currentCount + step);

  plotterZoomPointCount = nextCount >= maxPointCount ? null : nextCount;
  plotterHoverIndex = null;
  hidePlotterTooltip();
  drawPlotter();
}

// Maintenance examples: CO2 raw=771 ppm, filtered=801 ppm, T:27.7, TOUCH_POINTS=1 X=200 Y=303
function parsePlotterValues(line) {
  if (!plotterEnabledCheckbox.checked || plotterVariables.length === 0) {
    return;
  }

  let hasNewValue = false;
  plotterVariables.forEach((variable) => {
    const value = findPlotterValue(line, variable);
    if (value === null) {
      return;
    }

    appendPlotterValue(variable, value);
    hasNewValue = true;
  });

  if (hasNewValue) {
    drawPlotter();
  }
}

function drawPlotter() {
  updatePlotterLegend();
  if (plotterCanvasWrap.hidden) {
    return;
  }

  const context = plotterCanvas.getContext("2d");
  const pixelRatio = window.devicePixelRatio || 1;
  const width = plotterCanvas.clientWidth || plotterCanvas.width;
  const height = plotterCanvas.clientHeight || plotterCanvas.height;
  plotterCanvas.width = Math.floor(width * pixelRatio);
  plotterCanvas.height = Math.floor(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "rgba(0, 0, 0, 0.11)";
  context.lineWidth = 1;
  for (let index = 0; index < 5; index += 1) {
    const y = 14 + ((height - 36) / 4) * index;
    context.beginPath();
    context.moveTo(12, y);
    context.lineTo(width - 12, y);
    context.stroke();
  }

  const allValues = plotterVariables.flatMap((variable) => plotterData[variable] || []);
  context.fillStyle = "#6e6e73";
  context.font = "13px Consolas, 'Courier New', monospace";

  if (plotterVariables.length === 0) {
    context.fillText("设置变量后开始绘制", 14, 24);
    return;
  }

  if (allValues.length === 0) {
    context.fillText("等待串口文本数据...", 14, 24);
  }

  const globalMinValue = allValues.length > 0 ? Math.min(...allValues) : 0;
  const globalMaxValue = allValues.length > 0 ? Math.max(...allValues) : 1;
  const plotLeft = 14;
  const plotRight = width - 14;
  const plotTop = 14;
  const plotBottom = height - 22;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;
  const visiblePointCount = getVisiblePlotterPointCount();

  plotterVariables.forEach((variable, variableIndex) => {
    const points = getVisiblePlotterPoints(variable, visiblePointCount);
    const color = getPlotterColor(variable, variableIndex);

    if (points.length < 2) {
      return;
    }

    const range = plotterScaleModeSelect.value === "per-variable" ? getPlotterRange(points) : { min: globalMinValue, max: globalMaxValue };
    const minValue = range.min ?? 0;
    const maxValue = range.max ?? 1;
    const valueRange = maxValue === minValue ? 0 : maxValue - minValue;
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.beginPath();
    points.forEach((value, pointIndex) => {
      const x = getPlotterPointX(pointIndex, points.length, plotLeft, plotWidth);
      const y = valueRange === 0 ? plotTop + plotHeight / 2 : plotBottom - ((value - minValue) / valueRange) * plotHeight;
      if (pointIndex === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });
    context.stroke();
  });

  if (plotterHoverIndex !== null && visiblePointCount > 0) {
    const x = getPlotterPointX(plotterHoverIndex, visiblePointCount, plotLeft, plotWidth);
    context.strokeStyle = "rgba(0, 122, 255, 0.55)";
    context.lineWidth = 1;
    context.setLineDash([4, 4]);
    context.beginPath();
    context.moveTo(x, plotTop);
    context.lineTo(x, plotBottom);
    context.stroke();
    context.setLineDash([]);
  }
}

function scrollReceiveAreaIfNeeded() {
  if (autoScrollCheckbox.checked) {
    receiveArea.scrollTop = receiveArea.scrollHeight;
  }
}

function updateSearchMatchCount() {
  const keyword = getSearchKeyword();
  if (!keyword) {
    searchMatchCount.textContent = "";
    return;
  }

  searchMatchCount.textContent = `匹配：${getMatchedLogLines(keyword).length} 行`;
}

function updateStatsBar() {
  const keyword = getSearchKeyword();
  const matchedCount = keyword ? getMatchedLogLines(keyword).length : 0;

  totalLineCount.textContent = `总行数：${logLines.length}`;
  matchedLineCount.textContent = `匹配行数：${matchedCount}`;
  receiveByteCount.textContent = `接收字节数：${receiveBytes}`;
  sendCountDisplay.textContent = `发送次数：${sendCount}`;
}

function clearSearch() {
  searchInput.value = "";
  searchMatchCount.textContent = "";
  renderReceiveArea();
  searchInput.focus();
}

function applyQuickSearch(keyword) {
  searchInput.value = keyword;
  renderReceiveArea();
  searchInput.focus();
}

function loadSendHistory() {
  try {
    const savedHistory = localStorage.getItem(SEND_HISTORY_STORAGE_KEY);
    sendHistory = savedHistory ? JSON.parse(savedHistory) : [];
    if (!Array.isArray(sendHistory)) {
      sendHistory = [];
    }
  } catch (error) {
    sendHistory = [];
  }

  sendHistory = sendHistory
    .filter((item) => typeof item === "string" && item.length > 0)
    .slice(0, MAX_SEND_HISTORY);
  renderSendHistory();
}

function saveSendHistory() {
  try {
    localStorage.setItem(SEND_HISTORY_STORAGE_KEY, JSON.stringify(sendHistory));
  } catch (error) {
    setStatus(`保存发送历史失败：${error.message}`);
  }
}

function renderSendHistory() {
  sendHistorySelect.innerHTML = '<option value="">发送历史</option>';
  sendHistory.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    sendHistorySelect.appendChild(option);
  });
}

function addSendHistory(message) {
  sendHistory = sendHistory.filter((item) => item !== message);
  sendHistory.unshift(message);
  sendHistory = sendHistory.slice(0, MAX_SEND_HISTORY);
  saveSendHistory();
  renderSendHistory();
}

function clearSendHistory() {
  sendHistory = [];
  saveSendHistory();
  renderSendHistory();
  setStatus("发送历史已清空");
}

function parseQuickCommandsText(text) {
  return text
    .split(",")
    .map((command) => command.trim())
    .filter((command) => command.length > 0);
}

function loadQuickCommands() {
  try {
    const savedCommands = localStorage.getItem(QUICK_COMMANDS_STORAGE_KEY);
    quickCommands = savedCommands ? JSON.parse(savedCommands) : [...DEFAULT_QUICK_COMMANDS];
    if (!Array.isArray(quickCommands)) {
      quickCommands = [...DEFAULT_QUICK_COMMANDS];
    }
  } catch (error) {
    quickCommands = [...DEFAULT_QUICK_COMMANDS];
  }

  quickCommands = quickCommands.filter((command) => typeof command === "string" && command.length > 0);
  if (quickCommands.length === 0) {
    quickCommands = [...DEFAULT_QUICK_COMMANDS];
  }
  renderQuickCommands();
}

function saveQuickCommands() {
  try {
    localStorage.setItem(QUICK_COMMANDS_STORAGE_KEY, JSON.stringify(quickCommands));
  } catch (error) {
    setStatus(`保存常用命令失败：${error.message}`);
  }
}

function renderQuickCommands() {
  quickCommandInput.value = quickCommands.join(",");
  quickCommandButtons.innerHTML = "";

  quickCommands.forEach((command) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-command-button";
    button.dataset.command = command;
    button.textContent = command;
    button.addEventListener("click", () => {
      sendInput.value = command;
      sendInput.focus();
    });
    quickCommandButtons.appendChild(button);
  });
}

function applyQuickCommands() {
  const nextCommands = parseQuickCommandsText(quickCommandInput.value);
  quickCommands = nextCommands.length > 0 ? nextCommands : [...DEFAULT_QUICK_COMMANDS];
  saveQuickCommands();
  renderQuickCommands();
  setStatus("常用命令已更新");
}

function resetQuickCommands() {
  quickCommands = [...DEFAULT_QUICK_COMMANDS];
  saveQuickCommands();
  renderQuickCommands();
}

function shouldIgnoreGlobalShortcut(event) {
  return event.target instanceof HTMLSelectElement;
}

function handleGlobalKeydown(event) {
  if (shouldIgnoreGlobalShortcut(event)) {
    return;
  }

  if (event.ctrlKey && event.key.toLowerCase() === "l") {
    event.preventDefault();
    clearButton.click();
    return;
  }

  if (event.key === "Escape") {
    clearSearchButton.click();
  }
}

function getCurrentTimeText() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `[${hours}:${minutes}:${seconds}]`;
}

function setStatus(text) {
  statusBar.textContent = text;
  statusBar.classList.remove("status-success", "status-error");
  if (text.includes("已连接")) {
    statusBar.classList.add("status-success");
  } else if (text.includes("失败") || text.includes("错误") || text.includes("无法") || text.includes("未连接")) {
    statusBar.classList.add("status-error");
  }
}

function getConnectionMode() {
  return connectionModeSelect.value;
}

function isBleMode() {
  return getConnectionMode() === "ble";
}

function isConnected() {
  return Boolean(port || writer || bleWriteCharacteristic || bleDevice?.gatt?.connected);
}

function getDisconnectedStatusText() {
  return isBleMode() ? "未连接（BLE Bluetooth）" : "未连接（USB Serial）";
}

function updateConnectionModeUi() {
  const bleMode = isBleMode();
  bleConfigRow.hidden = !bleMode;
  baudRateSelect.closest(".baud-rate-field").hidden = bleMode;
  supportMessage.hidden = true;

  if (bleMode) {
    connectButton.textContent = "连接";
    disconnectButton.textContent = "断开";
    if (!isConnected()) {
      setConnectedState(false);
      setStatus(getDisconnectedStatusText());
    }
    return;
  }

  connectButton.textContent = "连接串口";
  disconnectButton.textContent = "断开串口";
  if (!("serial" in navigator)) {
    supportMessage.hidden = false;
    setStatus("当前浏览器不支持 Web Serial API，请使用 Chrome 或 Edge。");
    connectButton.disabled = true;
    disconnectButton.disabled = true;
    sendButton.disabled = true;
    return;
  }

  if (!isConnected()) {
    setConnectedState(false);
    setStatus(getDisconnectedStatusText());
  }
}

function setConnectedState(isConnected) {
  connectButton.disabled = isConnected;
  disconnectButton.disabled = !isConnected;
  sendButton.disabled = !isConnected;
  connectionModeSelect.disabled = isConnected;
  baudRateSelect.disabled = isConnected;
  bleServiceUuidInput.disabled = isConnected;
  bleTxUuidInput.disabled = isConnected;
  bleRxUuidInput.disabled = isConnected;
}

function isPortSelectionCanceled(error) {
  return error.name === "NotFoundError" || /no port selected/i.test(error.message);
}

function getSendEnding() {
  if (sendEndingSelect.value === "lf") {
    return "\n";
  }

  if (sendEndingSelect.value === "crlf") {
    return "\r\n";
  }

  return "";
}

function formatUsbId(id) {
  return `0x${id.toString(16).padStart(4, "0").toUpperCase()}`;
}

function getSerialDeviceHint(vendorId, productId) {
  if (vendorId === 0x1a86 && productId === 0x7523) {
    return "CH340/CH341 USB Serial";
  }

  if (vendorId === 0x1a86 && productId === 0x55d4) {
    return "CH343 USB Serial";
  }

  if (vendorId === 0x10c4 && productId === 0xea60) {
    return "CP210x USB to UART Bridge";
  }

  if (vendorId === 0x0403 && productId === 0x6001) {
    return "FT232 USB Serial";
  }

  if (vendorId === 0x303a) {
    return "Espressif USB Serial/JTAG 或 ESP32 USB CDC";
  }

  return "";
}

function clearDeviceInfoCache() {
  currentDeviceInfo = null;
}

function readDeviceInfoFromPort() {
  try {
    const info = port.getInfo();
    if (typeof info.usbVendorId === "number" && typeof info.usbProductId === "number") {
      return {
        usbVendorId: info.usbVendorId,
        usbProductId: info.usbProductId,
        possibleDevice: getSerialDeviceHint(info.usbVendorId, info.usbProductId),
      };
    }
  } catch (error) {
    return null;
  }

  return null;
}

function getConnectedStatusText(baudRate) {
  currentDeviceInfo = readDeviceInfoFromPort();

  if (currentDeviceInfo) {
    const baseStatus = `已连接，波特率 ${baudRate}，VID: ${formatUsbId(currentDeviceInfo.usbVendorId)}，PID: ${formatUsbId(currentDeviceInfo.usbProductId)}`;
    return currentDeviceInfo.possibleDevice ? `${baseStatus}，可能设备：${currentDeviceInfo.possibleDevice}` : baseStatus;
  }

  return `已连接，波特率 ${baudRate}`;
}

function getDeviceInfoText() {
  if (bleDevice) {
    const lines = [
      "Web Serial Debugger Device Info",
      "Status: Connected",
      "Mode: BLE Bluetooth",
      `Device Name: ${bleDevice.name || "Unknown BLE Device"}`,
      `Service UUID: ${bleServiceUuidInput.value.trim()}`,
      `TX Notify UUID: ${bleTxUuidInput.value.trim()}`,
      `RX Write UUID: ${bleRxUuidInput.value.trim()}`,
    ];

    return lines.join("\n");
  }

  const lines = [
    "Web Serial Debugger Device Info",
    "Status: Connected",
    "Mode: USB Serial",
    `Baudrate: ${baudRateSelect.value}`,
  ];

  if (currentDeviceInfo) {
    lines.push(`VID: ${formatUsbId(currentDeviceInfo.usbVendorId)}`);
    lines.push(`PID: ${formatUsbId(currentDeviceInfo.usbProductId)}`);

    if (currentDeviceInfo.possibleDevice) {
      lines.push(`Possible Device: ${currentDeviceInfo.possibleDevice}`);
    }
  }

  return lines.join("\n");
}

function getConnectedSystemLogText(baudRate) {
  const parts = [`[SYS] Connected, baudrate ${baudRate}`];

  if (currentDeviceInfo) {
    parts.push(`VID ${formatUsbId(currentDeviceInfo.usbVendorId)}`);
    parts.push(`PID ${formatUsbId(currentDeviceInfo.usbProductId)}`);

    if (currentDeviceInfo.possibleDevice) {
      parts.push(`Possible Device: ${currentDeviceInfo.possibleDevice}`);
    }
  }

  return parts.join(", ");
}

function appendReceivedData(value, decoder) {
  if (pauseReceiveDisplayCheckbox.checked) {
    receiveLineBuffer = "";
    return;
  }

  if (hexDisplayCheckbox.checked) {
    receiveLineBuffer = "";
    appendDisplayLine(formatHexBytes(value));
    return;
  }

  receiveLineBuffer += decoder.decode(value, { stream: true });
  const lines = receiveLineBuffer.split("\n");
  receiveLineBuffer = lines.pop() ?? "";

  lines.forEach((line) => {
    const cleanLine = line.replace(/\r$/, "");
    parsePlotterValues(cleanLine);
    appendDisplayLine(cleanLine);
  });
}

function flushReceiveLineBuffer() {
  if (!receiveLineBuffer) {
    return;
  }

  const cleanLine = receiveLineBuffer.replace(/\r$/, "");
  parsePlotterValues(cleanLine);
  appendDisplayLine(cleanLine);
  receiveLineBuffer = "";
}

function appendBleReceivedData(value) {
  if (pauseReceiveDisplayCheckbox.checked) {
    bleLineBuffer = "";
    return;
  }

  if (hexDisplayCheckbox.checked) {
    bleLineBuffer = "";
    appendDisplayLine(formatHexBytes(value));
    return;
  }

  bleLineBuffer += bleTextDecoder.decode(value, { stream: true });
  const lines = bleLineBuffer.split("\n");
  bleLineBuffer = lines.pop() ?? "";

  lines.forEach((line) => {
    const cleanLine = line.replace(/\r$/, "");
    parsePlotterValues(cleanLine);
    appendDisplayLine(cleanLine);
  });
}

function flushBleLineBuffer() {
  if (!bleLineBuffer) {
    return;
  }

  const cleanLine = bleLineBuffer.replace(/\r$/, "");
  parsePlotterValues(cleanLine);
  appendDisplayLine(cleanLine);
  bleLineBuffer = "";
}

async function closePortAfterReadError(errorMessage, systemLogText) {
  flushReceiveLineBuffer();

  if (writer) {
    try {
      writer.releaseLock();
    } catch (error) {
      errorMessage = `${errorMessage}；释放写入器失败：${error.message}`;
    }
    writer = null;
  }

  if (port) {
    try {
      await port.close();
    } catch (error) {
      errorMessage = `${errorMessage}；关闭串口失败：${error.message}`;
    }
    port = null;
  }

  readLoopPromise = null;
  clearDeviceInfoCache();
  setConnectedState(false);
  setStatus(errorMessage);
  appendDisplayLine(systemLogText);
}

function parseHexInput(input) {
  const normalized = input.replace(/\s+/g, "");
  if (!normalized || normalized.length % 2 !== 0 || /[^0-9a-fA-F]/.test(normalized)) {
    return null;
  }

  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < normalized.length; index += 2) {
    bytes[index / 2] = parseInt(normalized.slice(index, index + 2), 16);
  }

  return bytes;
}

function updateSendInputMode() {
  const isMultiLine = multiLineSendCheckbox.checked;
  sendInput.classList.toggle("multiline", isMultiLine);
  sendInput.rows = isMultiLine ? 4 : 1;
}

function formatHexBytes(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");
}

function confirmSendIfNeeded(message, isHexSend) {
  if (!confirmBeforeSendCheckbox.checked) {
    return true;
  }

  const title = isHexSend ? "确认 HEX 发送以下内容？" : "确认发送以下内容？";
  const confirmed = window.confirm(`${title}\n\n${message}`);
  if (!confirmed) {
    setStatus("已取消发送");
  }

  return confirmed;
}

function getLogFileName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `serial_log_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.txt`;
}

function getCurrentSettings() {
  return {
    baudRate: baudRateSelect.value,
    sendEnding: sendEndingSelect.value,
    hexDisplay: hexDisplayCheckbox.checked,
    hexSend: hexSendCheckbox.checked,
    multiLineSend: multiLineSendCheckbox.checked,
    confirmBeforeSend: confirmBeforeSendCheckbox.checked,
    autoScroll: autoScrollCheckbox.checked,
    showTimestamp: showTimestampCheckbox.checked,
    pauseReceiveDisplay: pauseReceiveDisplayCheckbox.checked,
    maxLogLines: maxLogLinesSelect.value,
    plotterEnabled: plotterEnabledCheckbox.checked,
    plotterVariables: plotterVariablesInput.value,
    plotterScaleMode: plotterScaleModeSelect.value,
    plotterVisible: !plotterCanvasWrap.hidden,
    bleServiceUuid: bleServiceUuidInput.value.trim(),
    bleTxUuid: bleTxUuidInput.value.trim(),
    bleRxUuid: bleRxUuidInput.value.trim(),
  };
}

function normalizeSettings(settings) {
  const normalized = { ...DEFAULT_SETTINGS, ...settings };
  const baudRateOptions = Array.from(baudRateSelect.options).map((option) => option.value);
  const sendEndingOptions = Array.from(sendEndingSelect.options).map((option) => option.value);
  const maxLogLinesOptions = Array.from(maxLogLinesSelect.options).map((option) => option.value);
  const plotterScaleModeOptions = Array.from(plotterScaleModeSelect.options).map((option) => option.value);

  if (!baudRateOptions.includes(normalized.baudRate)) {
    normalized.baudRate = DEFAULT_SETTINGS.baudRate;
  }

  if (!sendEndingOptions.includes(normalized.sendEnding)) {
    normalized.sendEnding = DEFAULT_SETTINGS.sendEnding;
  }

  if (!maxLogLinesOptions.includes(normalized.maxLogLines)) {
    normalized.maxLogLines = DEFAULT_SETTINGS.maxLogLines;
  }

  if (!plotterScaleModeOptions.includes(normalized.plotterScaleMode)) {
    normalized.plotterScaleMode = DEFAULT_SETTINGS.plotterScaleMode;
  }

  normalized.hexDisplay = Boolean(normalized.hexDisplay);
  normalized.hexSend = Boolean(normalized.hexSend);
  normalized.multiLineSend = Boolean(normalized.multiLineSend);
  normalized.confirmBeforeSend = Boolean(normalized.confirmBeforeSend);
  normalized.plotterEnabled = Boolean(normalized.plotterEnabled);
  normalized.plotterVariables = normalizePlotterVariables(String(normalized.plotterVariables ?? DEFAULT_PLOTTER_VARIABLES));
  normalized.plotterVisible = Boolean(normalized.plotterVisible);
  normalized.bleServiceUuid = String(normalized.bleServiceUuid || DEFAULT_BLE_SERVICE_UUID).trim();
  normalized.bleTxUuid = String(normalized.bleTxUuid || DEFAULT_BLE_TX_UUID).trim();
  normalized.bleRxUuid = String(normalized.bleRxUuid || DEFAULT_BLE_RX_UUID).trim();
  normalized.autoScroll = Boolean(normalized.autoScroll);
  normalized.showTimestamp = Boolean(normalized.showTimestamp);
  normalized.pauseReceiveDisplay = Boolean(normalized.pauseReceiveDisplay);

  return normalized;
}

function applySettings(settings) {
  const normalized = normalizeSettings(settings);

  baudRateSelect.value = normalized.baudRate;
  sendEndingSelect.value = normalized.sendEnding;
  hexDisplayCheckbox.checked = normalized.hexDisplay;
  hexSendCheckbox.checked = normalized.hexSend;
  multiLineSendCheckbox.checked = normalized.multiLineSend;
  confirmBeforeSendCheckbox.checked = normalized.confirmBeforeSend;
  autoScrollCheckbox.checked = normalized.autoScroll;
  showTimestampCheckbox.checked = normalized.showTimestamp;
  pauseReceiveDisplayCheckbox.checked = normalized.pauseReceiveDisplay;
  maxLogLinesSelect.value = normalized.maxLogLines;
  plotterEnabledCheckbox.checked = normalized.plotterEnabled;
  plotterVariablesInput.value = normalized.plotterVariables;
  plotterScaleModeSelect.value = normalized.plotterScaleMode;
  bleServiceUuidInput.value = normalized.bleServiceUuid;
  bleTxUuidInput.value = normalized.bleTxUuid;
  bleRxUuidInput.value = normalized.bleRxUuid;
  setPlotterVisible(normalized.plotterVisible);
  applyPlotterVariables();
  updateSendInputMode();
  trimLogLinesToLimit();
  renderReceiveArea();
}

function loadSettings() {
  try {
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!savedSettings) {
      applySettings(DEFAULT_SETTINGS);
      return;
    }

    applySettings(JSON.parse(savedSettings));
  } catch (error) {
    applySettings(DEFAULT_SETTINGS);
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(getCurrentSettings()));
  } catch (error) {
    setStatus(`保存设置失败：${error.message}`);
  }
}

function resetSettings() {
  try {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  } catch (error) {
    setStatus(`恢复默认设置失败：${error.message}`);
    return;
  }

  applySettings(DEFAULT_SETTINGS);
  connectionModeSelect.value = "usb";
  previousConnectionMode = "usb";
  updateConnectionModeUi();
  resetQuickCommands();
  clearPlotterData();
  setStatus("已恢复默认设置");
}

async function copyLog() {
  const logText = receiveArea.textContent;
  if (!logText) {
    setStatus("接收区为空，无法复制日志");
    return;
  }

  try {
    await navigator.clipboard.writeText(logText);
    setStatus("日志已复制到剪贴板");
  } catch (error) {
    setStatus(`复制失败：${error.message}`);
  }
}

async function copyDeviceInfo() {
  if (!isConnected()) {
    setStatus(isBleMode() ? "BLE 未连接，无法复制设备信息" : "串口未连接，无法复制设备信息");
    return;
  }

  try {
    await navigator.clipboard.writeText(getDeviceInfoText());
    setStatus("设备信息已复制到剪贴板");
  } catch (error) {
    setStatus(`复制设备信息失败：${error.message}`);
  }
}

function saveLog() {
  const logText = receiveArea.textContent;
  if (!logText) {
    setStatus("接收区为空，无法保存日志");
    return;
  }

  const blob = new Blob([logText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = getLogFileName();
  link.click();
  URL.revokeObjectURL(url);
  setStatus("日志已保存");
}

async function readLoop() {
  const decoder = new TextDecoder();
  let readErrorMessage = "";
  let systemLogText = "";
  keepReading = true;

  while (port?.readable && keepReading) {
    reader = port.readable.getReader();

    try {
      while (keepReading) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        if (value) {
          receiveBytes += value.length;
          updateStatsBar();
          appendReceivedData(value, decoder);
        }
      }
    } catch (error) {
      if (keepReading) {
        readErrorMessage = `读取失败：${error.message}`;
        systemLogText = `[SYS] Read error: ${error.message}`;
        keepReading = false;
      }
    } finally {
      try {
        reader.releaseLock();
      } catch (error) {
        if (!readErrorMessage && keepReading) {
          readErrorMessage = `释放读取器失败：${error.message}`;
          systemLogText = `[SYS] Read error: ${error.message}`;
        }
      }
      reader = null;
    }
  }

  if (!readErrorMessage && keepReading) {
    readErrorMessage = "串口连接已断开";
    systemLogText = "[SYS] Serial disconnected";
  }

  if (readErrorMessage) {
    await closePortAfterReadError(systemLogText ? readErrorMessage : "串口连接已断开", systemLogText || "[SYS] Serial disconnected");
  }
}

async function connectSerial() {
  if (!("serial" in navigator)) {
    setStatus("当前浏览器不支持 Web Serial API，请使用 Chrome 或 Edge。");
    return;
  }

  try {
    clearDeviceInfoCache();
    setStatus("正在连接（USB Serial）");
    port = await navigator.serial.requestPort();
    const baudRate = Number(baudRateSelect.value);
    await port.open({ baudRate });
    writer = port.writable.getWriter();
    setConnectedState(true);
    setStatus(getConnectedStatusText(baudRate));
    appendDisplayLine(getConnectedSystemLogText(baudRate));
    readLoopPromise = readLoop();
  } catch (error) {
    setStatus(isPortSelectionCanceled(error) ? "连接已取消" : `连接失败：${error.message}`);
    port = null;
    reader = null;
    writer = null;
    readLoopPromise = null;
    clearDeviceInfoCache();
    setConnectedState(false);
  }
}

async function disconnectSerial() {
  if (!port && !reader && !writer && !readLoopPromise) {
    clearDeviceInfoCache();
    setConnectedState(false);
    setStatus("未连接（USB Serial）");
    return;
  }

  keepReading = false;

  try {
    if (reader) {
      await reader.cancel();
    }

    if (readLoopPromise) {
      await readLoopPromise;
      readLoopPromise = null;
    }

    flushReceiveLineBuffer();

    if (writer) {
      writer.releaseLock();
      writer = null;
    }

    if (port) {
      await port.close();
      port = null;
    }

    clearDeviceInfoCache();
    setStatus("已断开（USB Serial）");
    appendDisplayLine("[SYS] Disconnected");
  } catch (error) {
    setStatus(`断开失败：${error.message}`);
  } finally {
    if (!port) {
      clearDeviceInfoCache();
      writer = null;
      readLoopPromise = null;
    }
    setConnectedState(false);
  }
}

function getBleDeviceName() {
  return bleDevice?.name || "Unknown BLE Device";
}

function cleanupBleState() {
  if (bleDevice) {
    bleDevice.removeEventListener("gattserverdisconnected", handleBleDisconnected);
  }
  bleNotifyCharacteristic = null;
  bleWriteCharacteristic = null;
  bleService = null;
  bleServer = null;
  bleDevice = null;
  bleTextDecoder = new TextDecoder();
  bleLineBuffer = "";
}

function handleBleDisconnected() {
  const expected = bleDisconnectExpected;
  flushBleLineBuffer();
  cleanupBleState();
  clearDeviceInfoCache();
  setConnectedState(false);
  if (!expected) {
    setStatus("BLE 已断开");
    appendDisplayLine("[SYS] BLE Disconnected");
  }
}

async function connectBle() {
  if (!("bluetooth" in navigator)) {
    setStatus("当前浏览器不支持 Web Bluetooth，请使用支持 Web Bluetooth 的 Chrome/Edge。");
    return;
  }

  const serviceUuid = bleServiceUuidInput.value.trim();
  const txUuid = bleTxUuidInput.value.trim();
  const rxUuid = bleRxUuidInput.value.trim();
  if (!serviceUuid || !txUuid || !rxUuid) {
    setStatus("BLE UUID 不能为空");
    return;
  }

  try {
    clearDeviceInfoCache();
    cleanupBleState();
    setStatus("正在连接（BLE Bluetooth）");
    connectButton.disabled = true;
    sendButton.disabled = true;
    bleDisconnectExpected = false;

    bleDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [serviceUuid],
    });
    bleDevice.addEventListener("gattserverdisconnected", handleBleDisconnected);
    bleServer = await bleDevice.gatt.connect();
    bleService = await bleServer.getPrimaryService(serviceUuid);
    bleNotifyCharacteristic = await bleService.getCharacteristic(txUuid);
    bleWriteCharacteristic = await bleService.getCharacteristic(rxUuid);
    await bleNotifyCharacteristic.startNotifications();
    bleNotifyCharacteristic.addEventListener("characteristicvaluechanged", handleBleNotification);

    setConnectedState(true);
    setStatus(`已连接 BLE：设备名 ${getBleDeviceName()}`);
    appendDisplayLine(`[SYS] BLE Connected: ${getBleDeviceName()}`);
  } catch (error) {
    cleanupBleState();
    clearDeviceInfoCache();
    setConnectedState(false);
    setStatus(error.name === "NotFoundError" ? "BLE 连接已取消" : `BLE 连接失败：${error.message}`);
  }
}

function handleBleNotification(event) {
  const dataView = event.target.value;
  const bytes = new Uint8Array(dataView.buffer.slice(dataView.byteOffset, dataView.byteOffset + dataView.byteLength));
  receiveBytes += bytes.length;
  updateStatsBar();
  appendBleReceivedData(bytes);
}

async function disconnectBle() {
  if (!bleDevice && !bleWriteCharacteristic && !bleNotifyCharacteristic) {
    cleanupBleState();
    setConnectedState(false);
    setStatus("未连接（BLE Bluetooth）");
    return;
  }

  try {
    bleDisconnectExpected = true;
    flushBleLineBuffer();
    if (bleNotifyCharacteristic) {
      try {
        bleNotifyCharacteristic.removeEventListener("characteristicvaluechanged", handleBleNotification);
        await bleNotifyCharacteristic.stopNotifications();
      } catch (error) {
        // Some devices disconnect before notifications can be stopped.
      }
    }
    if (bleDevice?.gatt?.connected) {
      bleDevice.removeEventListener("gattserverdisconnected", handleBleDisconnected);
      bleDevice.gatt.disconnect();
    }
    cleanupBleState();
    clearDeviceInfoCache();
    setConnectedState(false);
    setStatus("已断开（BLE Bluetooth）");
    appendDisplayLine("[SYS] BLE Disconnected");
  } catch (error) {
    setStatus(`BLE 断开失败：${error.message}`);
  } finally {
    bleDisconnectExpected = false;
  }
}

async function sendBleText() {
  if (!bleWriteCharacteristic) {
    setStatus("BLE 未连接，无法发送");
    return;
  }

  const preparedData = getPreparedSendData();
  if (!preparedData) {
    return;
  }

  try {
    await bleWriteCharacteristic.writeValue(preparedData.bytes);
    finishSuccessfulSend(preparedData);
  } catch (error) {
    setStatus(`发送失败：${error.message}`);
  }
}

function getPreparedSendData() {
  const message = sendInput.value;
  if (!message) {
    setStatus("发送内容为空");
    return null;
  }

  if (hexSendCheckbox.checked) {
    if (!message.replace(/\s+/g, "")) {
      setStatus("发送内容为空");
      return null;
    }

    const bytes = parseHexInput(message);
    if (!bytes) {
      setStatus("HEX 格式错误");
      return null;
    }

    if (!confirmSendIfNeeded(message, true)) {
      return null;
    }

    return {
      bytes,
      historyText: message,
      logText: `[TX HEX] ${formatHexBytes(bytes)}`,
    };
  }

  const text = `${message}${getSendEnding()}`;
  const encoder = new TextEncoder();

  if (!confirmSendIfNeeded(message, false)) {
    return null;
  }

  return {
    bytes: encoder.encode(text),
    historyText: message,
    logText: `[TX] ${message}`,
  };
}

function finishSuccessfulSend(preparedData) {
  sendCount += 1;
  addSendHistory(preparedData.historyText);
  appendDisplayLine(preparedData.logText);
  sendInput.value = "";
  sendInput.focus();
}

async function sendSerialText() {
  if (!writer) {
    setStatus("串口未连接，无法发送");
    return;
  }

  const preparedData = getPreparedSendData();
  if (!preparedData) {
    return;
  }

  try {
    await writer.write(preparedData.bytes);
    finishSuccessfulSend(preparedData);
  } catch (error) {
    setStatus(`发送失败：${error.message}`);
  }
}

function connectCurrentMode() {
  if (isBleMode()) {
    connectBle();
    return;
  }

  connectSerial();
}

function disconnectCurrentMode() {
  if (isBleMode()) {
    disconnectBle();
    return;
  }

  disconnectSerial();
}

function sendCurrentMode() {
  if (isBleMode()) {
    sendBleText();
    return;
  }

  sendSerialText();
}

function handleConnectionModeChange() {
  if (isConnected()) {
    connectionModeSelect.value = previousConnectionMode;
    setStatus("请先断开当前连接后再切换连接模式");
    return;
  }

  previousConnectionMode = connectionModeSelect.value;
  updateConnectionModeUi();
}

loadSettings();
loadSendHistory();
loadQuickCommands();
updateStatsBar();
drawPlotter();
setConnectedState(false);
updateConnectionModeUi();

connectButton.addEventListener("click", connectCurrentMode);
disconnectButton.addEventListener("click", disconnectCurrentMode);
clearButton.addEventListener("click", () => {
  logLines = [];
  receiveLineBuffer = "";
  bleLineBuffer = "";
  receiveBytes = 0;
  sendCount = 0;
  renderReceiveArea();
});
saveLogButton.addEventListener("click", saveLog);
copyLogButton.addEventListener("click", copyLog);
copyDeviceInfoButton.addEventListener("click", copyDeviceInfo);
resetSettingsButton.addEventListener("click", resetSettings);
searchInput.addEventListener("input", renderReceiveArea);
clearSearchButton.addEventListener("click", clearSearch);
sendHistorySelect.addEventListener("change", () => {
  if (sendHistorySelect.value) {
    sendInput.value = sendHistorySelect.value;
    sendHistorySelect.value = "";
    sendInput.focus();
  }
});
clearHistoryButton.addEventListener("click", clearSendHistory);
applyQuickCommandsButton.addEventListener("click", applyQuickCommands);
applyPlotterVariablesButton.addEventListener("click", () => {
  applyPlotterVariables();
  saveSettings();
});
clearPlotterButton.addEventListener("click", clearPlotterData);
resetPlotterZoomButton.addEventListener("click", () => {
  resetPlotterZoom();
  drawPlotter();
});
togglePlotterViewButton.addEventListener("click", () => {
  setPlotterVisible(plotterCanvasWrap.hidden);
  saveSettings();
});
plotterCanvas.addEventListener("mousemove", handlePlotterMouseMove);
plotterCanvas.addEventListener("mouseleave", handlePlotterMouseLeave);
plotterCanvas.addEventListener("wheel", handlePlotterWheel, { passive: false });
quickSearchButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyQuickSearch(button.dataset.keyword);
  });
});
showOnlyMatchesCheckbox.addEventListener("change", renderReceiveArea);
maxLogLinesSelect.addEventListener("change", () => {
  trimLogLinesToLimit();
  renderReceiveArea();
});
pauseReceiveDisplayCheckbox.addEventListener("change", () => {
  receiveLineBuffer = "";
  if (pauseReceiveDisplayCheckbox.checked) {
    setStatus("已暂停接收显示");
  } else {
    setStatus("已恢复接收显示");
  }
});
sendButton.addEventListener("click", sendCurrentMode);
sendInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.isComposing) {
    return;
  }

  if (multiLineSendCheckbox.checked) {
    if (event.ctrlKey) {
      event.preventDefault();
      sendCurrentMode();
    }
    return;
  }

  event.preventDefault();
  sendCurrentMode();
});
document.addEventListener("keydown", handleGlobalKeydown);
connectionModeSelect.addEventListener("change", handleConnectionModeChange);

[
  baudRateSelect,
  sendEndingSelect,
  hexDisplayCheckbox,
  hexSendCheckbox,
  multiLineSendCheckbox,
  confirmBeforeSendCheckbox,
  autoScrollCheckbox,
  showTimestampCheckbox,
  pauseReceiveDisplayCheckbox,
  maxLogLinesSelect,
  plotterEnabledCheckbox,
  plotterScaleModeSelect,
  bleServiceUuidInput,
  bleTxUuidInput,
  bleRxUuidInput,
].forEach((control) => {
  control.addEventListener("change", saveSettings);
});

multiLineSendCheckbox.addEventListener("change", updateSendInputMode);
plotterEnabledCheckbox.addEventListener("change", drawPlotter);
plotterScaleModeSelect.addEventListener("change", drawPlotter);

updateConnectionModeUi();
