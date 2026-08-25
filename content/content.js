// content/content.js - 页面内容提取脚本

function isKickstarterProject(url) {
  try {
    const urlObj = new URL(url);
    const { hostname } = urlObj;
    // 精确匹配主域或子域，避免误匹配 xkickstarter.com 之类
    return (hostname === 'kickstarter.com' || hostname.endsWith('.kickstarter.com')) &&
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
  if (message.type === 'EXTRACT_CONTENT') {
    handleExtractContent(sendResponse);
    return true; // 保持消息通道开放
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
    respondWithResult(sendResponse, result);
    return;
  }

  // 其他域名查询存储规则
  const storageResult = await chrome.storage.local.get('domainRules');
  const rules = storageResult.domainRules || {};
  const rule = rules[domain];

  if (rule) {
    const result = extractByRule(rule);
    respondWithResult(sendResponse, result);
  } else {
    sendResponse({ type: 'NEED_CONFIG', domain });
  }
}

// 统一响应：缺主视频时返回 EXTRACT_FAILED 并附带部分数据，否则返回 EXTRACT_RESULT
function respondWithResult(sendResponse, result) {
  if (!result.videoUrl) {
    sendResponse({
      type: 'EXTRACT_FAILED',
      missing: ['videoUrl'],
      error: '未找到主视频元素',
      data: result
    });
  } else {
    sendResponse({ type: 'EXTRACT_RESULT', data: result });
  }
}
