// content/content.js - 页面内容提取脚本

function isKickstarterProject(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.endsWith('kickstarter.com') &&
           urlObj.pathname.startsWith('/projects/');
  } catch {
    return false;
  }
}

function getDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
}

function extractVideoUrl(videoElement) {
  const sources = videoElement.querySelectorAll('source');
  if (sources.length === 0) return null;

  // 优先级1: _high.mp4
  const highMp4 = [...sources].find(s => s.src && s.src.endsWith('_high.mp4'));
  if (highMp4) return highMp4.src;

  // 优先级2: .m3u8
  const m3u8 = [...sources].find(s => s.src && s.src.endsWith('.m3u8'));
  if (m3u8) return m3u8.src;

  // 优先级3: 第一个source
  return sources[0].src || null;
}

function extractKickstarterContent() {
  const result = {
    pageUrl: window.location.href,
    pageTitle: document.title || '未命名',
    videoUrl: null,
    imageUrl: null
  };

  // 提取视频: class="z1"的video标签
  const videoElement = document.querySelector('video.z1');
  if (videoElement) {
    result.videoUrl = extractVideoUrl(videoElement);
  }

  // 提取封面图: class="z3"的img标签
  const imgElement = document.querySelector('img.z3');
  if (imgElement) {
    result.imageUrl = imgElement.src || null;
  }

  return result;
}

function extractByRule(rule) {
  const result = {
    pageUrl: window.location.href,
    pageTitle: document.title || '未命名',
    videoUrl: null,
    imageUrl: null
  };

  // 提取视频
  const videoSelector = rule.videoSelectorType === 'id'
    ? `video#${rule.videoSelectorValue}`
    : `video.${rule.videoSelectorValue}`;
  const videoElement = document.querySelector(videoSelector);
  if (videoElement) {
    result.videoUrl = extractVideoUrl(videoElement);
  }

  // 提取封面图
  const imageSelector = rule.imageSelectorType === 'id'
    ? `img#${rule.imageSelectorValue}`
    : `img.${rule.imageSelectorValue}`;
  const imgElement = document.querySelector(imageSelector);
  if (imgElement) {
    result.imageUrl = imgElement.src || null;
  }

  return result;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_CONTENT') {
    handleExtractContent(sendResponse);
    return true;
  }
});

async function handleExtractContent(sendResponse) {
  const url = window.location.href;
  const domain = getDomain(url);

  // 检查是否为特殊页面
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
    sendResponse({ type: 'EXTRACT_FAILED', error: '无法访问此类型页面' });
    return;
  }

  // Kickstarter项目页使用内置规则
  if (isKickstarterProject(url)) {
    const result = extractKickstarterContent();
    if (!result.videoUrl) {
      sendResponse({
        type: 'EXTRACT_FAILED',
        missing: ['videoUrl'],
        error: '未找到主视频元素'
      });
    } else {
      sendResponse({ type: 'EXTRACT_RESULT', data: result });
    }
    return;
  }

  // 其他域名查询存储规则
  const storageResult = await chrome.storage.local.get('domainRules');
  const rules = storageResult.domainRules || {};
  const rule = rules[domain];

  if (rule) {
    const result = extractByRule(rule);
    if (!result.videoUrl) {
      sendResponse({
        type: 'EXTRACT_FAILED',
        missing: ['videoUrl'],
        error: '未找到主视频元素'
      });
    } else {
      sendResponse({ type: 'EXTRACT_RESULT', data: result });
    }
  } else {
    sendResponse({ type: 'NEED_CONFIG', domain });
  }
}
