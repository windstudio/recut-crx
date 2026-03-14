// background/service-worker.js

// 设置sidePanel在点击图标时打开
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// 监听来自sidePanel和content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // 保持消息通道开放
});

async function handleMessage(message, sender, sendResponse) {
  switch (message.type) {
    case 'EXTRACT_CONTENT':
      await handleExtractContent(message, sendResponse);
      break;
    case 'SAVE_RULE':
      await handleSaveRule(message, sendResponse);
      break;
    case 'GET_RULE':
      await handleGetRule(message, sendResponse);
      break;
    default:
      sendResponse({ error: 'Unknown message type' });
  }
}

async function handleExtractContent(message, sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      sendResponse({ type: 'EXTRACT_FAILED', error: 'No active tab' });
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_CONTENT' });
    sendResponse(response);
  } catch (error) {
    sendResponse({ type: 'EXTRACT_FAILED', error: error.message });
  }
}

async function handleSaveRule(message, sendResponse) {
  try {
    const { domain, videoSelectorType, videoSelectorValue, imageSelectorType, imageSelectorValue } = message;
    const result = await chrome.storage.local.get('domainRules');
    const rules = result.domainRules || {};
    rules[domain] = {
      videoSelectorType,
      videoSelectorValue,
      imageSelectorType,
      imageSelectorValue
    };
    await chrome.storage.local.set({ domainRules: rules });
    sendResponse({ type: 'RULE_SAVED' });
  } catch (error) {
    sendResponse({ error: error.message });
  }
}

async function handleGetRule(message, sendResponse) {
  try {
    const { domain } = message;
    const result = await chrome.storage.local.get('domainRules');
    const rules = result.domainRules || {};
    sendResponse({ type: 'RULE_RESULT', rule: rules[domain] || null });
  } catch (error) {
    sendResponse({ error: error.message });
  }
}
