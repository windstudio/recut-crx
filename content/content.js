// content/content.js - 页面内容提取脚本

function isKickstarterProject(url) {
  try {
    const urlObj = new URL(url);
    return RECUT.isKickstarterHostname(urlObj.hostname) &&
           urlObj.pathname.startsWith(RECUT.KICKSTARTER.PROJECT_PATH_PREFIX);
  } catch {
    return false;
  }
}

function extractVideoUrl(videoElement) {
  const sources = videoElement.querySelectorAll('source');

  if (sources.length === 0) return null;

  // 优先级1: _high.mp4
  const highMp4 = [...sources].find(s => s.src && s.src.endsWith('_high.mp4'));
  if (highMp4) {
    return highMp4.src;
  }

  // 优先级2: .m3u8
  const m3u8 = [...sources].find(s => s.src && s.src.endsWith('.m3u8'));
  if (m3u8) {
    return m3u8.src;
  }

  // 优先级3: 第一个source
  return sources[0].src || null;
}

function generateDefaultOutputFile(url) {
  try {
    const pathParts = new URL(url).pathname.split('/').filter(Boolean);
    if (pathParts.length === 0) return '';
    const lastPart = pathParts[pathParts.length - 1];
    // 移除查询参数和锚点
    const cleanName = lastPart.split(/[?#]/)[0];
    return cleanName ? cleanName + '.mp4' : '';
  } catch {
    return '';
  }
}

function getPageTitle() {
  // 优先从 <h1> 获取标题
  const h1 = document.querySelector('h1');
  if (h1?.textContent?.trim()) {
    return h1.textContent.trim();
  }

  // 回退到 <title>，移除已知的网站后缀
  let title = document.title || '未命名';
  // 移除 Kickstarter 后缀
  if (title.endsWith(' — Kickstarter')) {
    title = title.slice(0, -14);
  }
  return title.trim() || '未命名';
}

function extractKickstarterContent() {
  const result = {
    pageUrl: window.location.href,
    pageTitle: getPageTitle(),
    videoUrl: null,
    imageUrl: null,
    outputFile: generateDefaultOutputFile(window.location.href)
  };

  // 提取视频与封面图：选择器来自共享常量中的内置规则
  const videoElement = document.querySelector(RECUT.KICKSTARTER.VIDEO_SELECTOR);
  if (videoElement) {
    result.videoUrl = extractVideoUrl(videoElement);
  }

  const imgElement = document.querySelector(RECUT.KICKSTARTER.IMAGE_SELECTOR);
  if (imgElement) {
    result.imageUrl = imgElement.src || null;
  }

  return result;
}

function extractByRule(rule) {
  const result = {
    pageUrl: window.location.href,
    pageTitle: getPageTitle(),
    videoUrl: null,
    imageUrl: null,
    outputFile: generateDefaultOutputFile(window.location.href)
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
  if (rule.imageSelectorValue) {
    const imageSelector = rule.imageSelectorType === 'id'
      ? `img#${rule.imageSelectorValue}`
      : `img.${rule.imageSelectorValue}`;
    const imgElement = document.querySelector(imageSelector);
    if (imgElement) {
      result.imageUrl = imgElement.src || null;
    }
  }

  return result;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === RECUT.MSG.EXTRACT_CONTENT) {
    handleExtractContent(sendResponse);
    return true; // 保持消息通道开放
  }
});

async function handleExtractContent(sendResponse) {
  const url = window.location.href;
  const domain = RECUT.getDomain(url);

  // 检查是否为特殊页面
  if (RECUT.isSpecialUrl(url)) {
    sendResponse({ type: RECUT.MSG.EXTRACT_FAILED, error: '无法访问此类型页面' });
    return;
  }

  // Kickstarter项目页使用内置规则
  if (isKickstarterProject(url)) {
    const result = extractKickstarterContent();
    respondWithResult(sendResponse, result);
    return;
  }

  // 其他域名查询存储规则
  const storageResult = await chrome.storage.local.get(RECUT.STORAGE.DOMAIN_RULES);
  const rules = storageResult[RECUT.STORAGE.DOMAIN_RULES] || {};
  const rule = rules[domain];

  if (rule) {
    const result = extractByRule(rule);
    respondWithResult(sendResponse, result);
  } else {
    sendResponse({ type: RECUT.MSG.NEED_CONFIG, domain });
  }
}

// 统一响应：缺主视频时返回 EXTRACT_FAILED 并附带部分数据，否则返回 EXTRACT_RESULT
function respondWithResult(sendResponse, result) {
  if (!result.videoUrl) {
    sendResponse({
      type: RECUT.MSG.EXTRACT_FAILED,
      missing: ['videoUrl'],
      error: '未找到主视频元素',
      data: result
    });
  } else {
    sendResponse({ type: RECUT.MSG.EXTRACT_RESULT, data: result });
  }
}
