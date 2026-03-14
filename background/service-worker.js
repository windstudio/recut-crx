// background/service-worker.js

// 设置sidePanel在点击图标时打开
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

// 监听来自sidePanel和content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // 保持消息通道开放
});

async function handleMessage(message, sender, sendResponse) {
  console.log('Received message:', message.type);

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
    console.log('Active tab:', tab);

    if (!tab) {
      sendResponse({ type: 'EXTRACT_FAILED', error: 'No active tab' });
      return;
    }

    if (!tab.id) {
      sendResponse({ type: 'EXTRACT_FAILED', error: 'Tab has no ID' });
      return;
    }

    // 检查是否为特殊页面
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) {
      sendResponse({ type: 'EXTRACT_FAILED', error: '无法访问此类型页面' });
      return;
    }

    console.log('Sending message to tab:', tab.id);

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_CONTENT' });
    console.log('Response from content script:', response);
    sendResponse(response);
  } catch (error) {
    console.error('handleExtractContent error:', error);
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
    console.log('Rule saved:', domain, rules[domain]);
    sendResponse({ type: 'RULE_SAVED' });
  } catch (error) {
    console.error('handleSaveRule error:', error);
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
    console.error('handleGetRule error:', error);
    sendResponse({ error: error.message });
  }
}
