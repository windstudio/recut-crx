// content/content.js - 页面内容提取脚本

console.log('Content script loaded');

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
  console.log('Found sources:', sources.length);

  if (sources.length === 0) return null;

  // 优先级1: _high.mp4
  const highMp4 = [...sources].find(s => s.src && s.src.endsWith('_high.mp4'));
  if (highMp4) {
    console.log('Found _high.mp4:', highMp4.src);
    return highMp4.src;
  }

  // 优先级2: .m3u8
  const m3u8 = [...sources].find(s => s.src && s.src.endsWith('.m3u8'));
  if (m3u8) {
    console.log('Found .m3u8:', m3u8.src);
    return m3u8.src;
  }

  // 优先级3: 第一个source
  const firstSrc = sources[0].src || null;
  console.log('Using first source:', firstSrc);
  return firstSrc;
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
  console.log('Extracting Kickstarter content...');

  const result = {
    pageUrl: window.location.href,
    pageTitle: getPageTitle(),
    videoUrl: null,
    imageUrl: null,
    outputFile: generateDefaultOutputFile(window.location.href),
    isKickstarter: true
  };

  // 提取视频: class="z1"的video标签
  const videoElement = document.querySelector('video.z1');
  console.log('Video element (video.z1):', videoElement);
  if (videoElement) {
    result.videoUrl = extractVideoUrl(videoElement);
  }

  // 提取封面图: class="z3"的img标签
  const imgElement = document.querySelector('img.z3');
  console.log('Image element (img.z3):', imgElement);
  if (imgElement) {
    result.imageUrl = imgElement.src || null;
  }

  console.log('Extracted result:', result);
  return result;
}

function extractByRule(rule) {
  console.log('Extracting by rule:', rule);

  const result = {
    pageUrl: window.location.href,
    pageTitle: getPageTitle(),
    videoUrl: null,
    imageUrl: null,
    outputFile: generateDefaultOutputFile(window.location.href),
    isKickstarter: false
  };

  // 提取视频
  const videoSelector = rule.videoSelectorType === 'id'
    ? `video#${rule.videoSelectorValue}`
    : `video.${rule.videoSelectorValue}`;
  console.log('Video selector:', videoSelector);
  const videoElement = document.querySelector(videoSelector);
  if (videoElement) {
    result.videoUrl = extractVideoUrl(videoElement);
  }

  // 提取封面图
  if (rule.imageSelectorValue) {
    const imageSelector = rule.imageSelectorType === 'id'
      ? `img#${rule.imageSelectorValue}`
      : `img.${rule.imageSelectorValue}`;
    console.log('Image selector:', imageSelector);
    const imgElement = document.querySelector(imageSelector);
    if (imgElement) {
      result.imageUrl = imgElement.src || null;
    }
  }

  console.log('Extracted result:', result);
  return result;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message.type);

  if (message.type === 'EXTRACT_CONTENT') {
    handleExtractContent(sendResponse);
    return true; // 保持消息通道开放
  }
});

async function handleExtractContent(sendResponse) {
  const url = window.location.href;
  const domain = getDomain(url);
  console.log('Current URL:', url, 'Domain:', domain);

  // 检查是否为特殊页面
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
    sendResponse({ type: 'EXTRACT_FAILED', error: '无法访问此类型页面' });
    return;
  }

  // Kickstarter项目页使用内置规则
  if (isKickstarterProject(url)) {
    console.log('Using Kickstarter built-in rules');
    const result = extractKickstarterContent();
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
    return;
  }

  // 其他域名查询存储规则
  console.log('Querying storage for domain rules...');
  const storageResult = await chrome.storage.local.get('domainRules');
  const rules = storageResult.domainRules || {};
  const rule = rules[domain];
  console.log('Found rule for domain:', rule);

  if (rule) {
    const result = extractByRule(rule);
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
  } else {
    sendResponse({ type: 'NEED_CONFIG', domain });
  }
}
