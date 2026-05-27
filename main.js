const baudRateSelect = document.getElementById("baudRate");
const connectButton = document.getElementById("connectButton");
const disconnectButton = document.getElementById("disconnectButton");
const clearButton = document.getElementById("clearButton");
const saveLogButton = document.getElementById("saveLogButton");
const hexDisplayCheckbox = document.getElementById("hexDisplay");
const pauseReceiveDisplayCheckbox = document.getElementById("pauseReceiveDisplay");
const autoScrollCheckbox = document.getElementById("autoScroll");
const showTimestampCheckbox = document.getElementById("showTimestamp");
const receiveArea = document.getElementById("receiveArea");
const sendInput = document.getElementById("sendInput");
const sendEndingSelect = document.getElementById("sendEnding");
const hexSendCheckbox = document.getElementById("hexSend");
const sendButton = document.getElementById("sendButton");
const supportMessage = document.getElementById("supportMessage");
const statusBar = document.getElementById("statusBar");

let port = null;
let reader = null;
let writer = null;
let keepReading = false;
let readLoopPromise = null;

function appendReceivedText(text) {
  receiveArea.textContent += formatDisplayText(text);
  if (autoScrollCheckbox.checked) {
    receiveArea.scrollTop = receiveArea.scrollHeight;
  }
}

function formatDisplayText(text) {
  if (!showTimestampCheckbox.checked) {
    return text;
  }

  return `${getCurrentTimeText()} ${text}`;
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
}

function setConnectedState(isConnected) {
  connectButton.disabled = isConnected;
  disconnectButton.disabled = !isConnected;
  sendButton.disabled = !isConnected;
  baudRateSelect.disabled = isConnected;
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

function formatReceivedData(value, decoder) {
  if (!hexDisplayCheckbox.checked) {
    return decoder.decode(value, { stream: true });
  }

  return `${formatHexBytes(value)}\n`;
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

function formatHexBytes(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0").toUpperCase())
    .join(" ");
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
  keepReading = true;

  while (port?.readable && keepReading) {
    reader = port.readable.getReader();

    try {
      while (keepReading) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        if (value && !pauseReceiveDisplayCheckbox.checked) {
          appendReceivedText(formatReceivedData(value, decoder));
        }
      }
    } catch (error) {
      if (keepReading) {
        setStatus(`读取失败：${error.message}`);
      }
    } finally {
      reader.releaseLock();
      reader = null;
    }
  }
}

async function connectSerial() {
  if (!("serial" in navigator)) {
    return;
  }

  try {
    setStatus("正在连接");
    port = await navigator.serial.requestPort();
    const baudRate = Number(baudRateSelect.value);
    await port.open({ baudRate });
    writer = port.writable.getWriter();
    setConnectedState(true);
    setStatus(`已连接，波特率 ${baudRate}`);
    readLoopPromise = readLoop();
  } catch (error) {
    setStatus(`连接失败：${error.message}`);
    port = null;
    setConnectedState(false);
  }
}

async function disconnectSerial() {
  keepReading = false;

  try {
    if (reader) {
      await reader.cancel();
    }

    if (readLoopPromise) {
      await readLoopPromise;
      readLoopPromise = null;
    }

    if (writer) {
      writer.releaseLock();
      writer = null;
    }

    if (port) {
      await port.close();
      port = null;
    }

    setStatus("已断开");
  } catch (error) {
    setStatus(`断开失败：${error.message}`);
  } finally {
    setConnectedState(false);
  }
}

async function sendSerialText() {
  if (!writer) {
    setStatus("串口未连接，无法发送");
    return;
  }

  const message = sendInput.value;
  if (!message) {
    setStatus("发送内容为空");
    return;
  }

  if (hexSendCheckbox.checked) {
    if (!message.replace(/\s+/g, "")) {
      setStatus("发送内容为空");
      return;
    }

    const bytes = parseHexInput(message);
    if (!bytes) {
      setStatus("HEX 格式错误");
      return;
    }

    try {
      await writer.write(bytes);
      appendReceivedText(`[TX HEX] ${formatHexBytes(bytes)}\n`);
      sendInput.value = "";
      sendInput.focus();
    } catch (error) {
      setStatus(`发送失败：${error.message}`);
    }

    return;
  }

  const text = `${message}${getSendEnding()}`;
  const encoder = new TextEncoder();

  try {
    await writer.write(encoder.encode(text));
    appendReceivedText(`[TX] ${message}\n`);
    sendInput.value = "";
    sendInput.focus();
  } catch (error) {
    setStatus(`发送失败：${error.message}`);
  }
}

connectButton.addEventListener("click", connectSerial);
disconnectButton.addEventListener("click", disconnectSerial);
clearButton.addEventListener("click", () => {
  receiveArea.textContent = "";
});
saveLogButton.addEventListener("click", saveLog);
pauseReceiveDisplayCheckbox.addEventListener("change", () => {
  if (pauseReceiveDisplayCheckbox.checked) {
    setStatus("已暂停接收显示");
  } else {
    setStatus("已恢复接收显示");
  }
});
sendButton.addEventListener("click", sendSerialText);
sendInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendSerialText();
  }
});

if (!("serial" in navigator)) {
  supportMessage.hidden = false;
  setStatus("未连接");
  connectButton.disabled = true;
  disconnectButton.disabled = true;
  sendButton.disabled = true;
}
