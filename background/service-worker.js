// background/service-worker.js

// 共享常量（消息协议、存储键、特殊页面清单）
import '../shared/constants.js';

// 设置sidePanel在点击图标时打开
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

// 监听来自sidePanel和content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // 保持消息通道开放
});

async function handleMessage(message, sender, sendResponse) {
  switch (message.type) {
    case RECUT.MSG.EXTRACT_CONTENT:
      await handleExtractContent(message, sendResponse);
      break;
    case RECUT.MSG.SAVE_RULE:
      await handleSaveRule(message, sendResponse);
      break;
    default:
      sendResponse({ error: 'Unknown message type' });
  }
}

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['shared/constants.js', 'content/content.js']
    });
    return true;
  } catch (error) {
    console.error('Failed to inject content script:', error);
    return false;
  }
}

async function handleExtractContent(message, sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      sendResponse({ type: RECUT.MSG.EXTRACT_FAILED, error: 'No active tab' });
      return;
    }

    if (!tab.id) {
      sendResponse({ type: RECUT.MSG.EXTRACT_FAILED, error: 'Tab has no ID' });
      return;
    }

    // 检查是否为特殊页面
    if (!tab.url || RECUT.isSpecialUrl(tab.url)) {
      sendResponse({ type: RECUT.MSG.EXTRACT_FAILED, error: '无法访问此类型页面' });
      return;
    }

    // 尝试发送消息，如果失败则注入content script后重试
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: RECUT.MSG.EXTRACT_CONTENT });
      sendResponse(response);
    } catch (error) {
      const injected = await injectContentScript(tab.id);
      if (injected) {
        // 等待一下让脚本执行
        await new Promise(resolve => setTimeout(resolve, 100));
        const response = await chrome.tabs.sendMessage(tab.id, { type: RECUT.MSG.EXTRACT_CONTENT });
        sendResponse(response);
      } else {
        sendResponse({ type: RECUT.MSG.EXTRACT_FAILED, error: '无法注入内容脚本' });
      }
    }
  } catch (error) {
    console.error('handleExtractContent error:', error);
    sendResponse({ type: RECUT.MSG.EXTRACT_FAILED, error: error.message });
  }
}

async function handleSaveRule(message, sendResponse) {
  try {
    const { domain, videoSelectorType, videoSelectorValue, imageSelectorType, imageSelectorValue } = message;
    const result = await chrome.storage.local.get(RECUT.STORAGE.DOMAIN_RULES);
    const rules = result[RECUT.STORAGE.DOMAIN_RULES] || {};
    rules[domain] = {
      videoSelectorType,
      videoSelectorValue,
      imageSelectorType,
      imageSelectorValue
    };
    await chrome.storage.local.set({ [RECUT.STORAGE.DOMAIN_RULES]: rules });
    sendResponse({ type: RECUT.MSG.RULE_SAVED });
  } catch (error) {
    console.error('handleSaveRule error:', error);
    sendResponse({ error: error.message });
  }
}
