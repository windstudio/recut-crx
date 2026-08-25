// sidepanel.js - 侧边栏逻辑

// 状态
let currentData = {
  pageUrl: '',
  pageTitle: '',
  videoUrl: '',
  imageUrl: '',
  outputFile: '',
  language: 'english',
  ttsEngine: 'minimax',
  isKickstarter: false
};

let currentDomain = '';

// DOM元素
const elements = {
  loadingState: document.getElementById('loadingState'),
  contentForm: document.getElementById('contentForm'),
  configForm: document.getElementById('configForm'),
  pageUrlPreview: document.getElementById('pageUrlPreview'),
  pageUrlFull: document.getElementById('pageUrlFull'),
  pageTitle: document.getElementById('pageTitle'),
  language: document.getElementById('language'),
  videoUrlPreview: document.getElementById('videoUrlPreview'),
  videoUrlFull: document.getElementById('videoUrlFull'),
  imageUrlPreview: document.getElementById('imageUrlPreview'),
  imageUrlFull: document.getElementById('imageUrlFull'),
  outputFile: document.getElementById('outputFile'),
  copyBtn: document.getElementById('copyBtn'),
  copySemiAutoBtn: document.getElementById('copySemiAutoBtn'),
  retryBtn: document.getElementById('retryBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  backBtn: document.getElementById('backBtn'),
  configDomain: document.getElementById('configDomain'),
  videoSelectorType: document.getElementById('videoSelectorType'),
  videoSelectorValue: document.getElementById('videoSelectorValue'),
  imageSelectorType: document.getElementById('imageSelectorType'),
  imageSelectorValue: document.getElementById('imageSelectorValue'),
  toast: document.getElementById('toast')
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  extractContent();
});

function initEventListeners() {
  // 重试按钮
  elements.retryBtn.addEventListener('click', () => {
    clearData();
    extractContent();
  });

  // 设置按钮
  elements.settingsBtn.addEventListener('click', () => {
    showConfigForm();
  });

  // 返回按钮：回到主界面并展示已提取数据。
  // 不能重新提取——否则未配置规则的域名会再次进入配置页形成死循环
  elements.backBtn.addEventListener('click', () => {
    showContentForm();
    updateUI();
  });

  // 复制按钮
  elements.copyBtn.addEventListener('click', () => {
    copyCommand(false);
  });

  elements.copySemiAutoBtn.addEventListener('click', () => {
    copyCommand(true);
  });

  // URL展开/收起
  document.querySelectorAll('.toggle-url').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const field = e.currentTarget.closest('.url-field');
      field.classList.toggle('expanded');
    });
  });

  // 配置表单提交
  elements.configForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveRule();
  });

  // 标题输入更新
  elements.pageTitle.addEventListener('input', (e) => {
    currentData.pageTitle = e.target.value;
  });

  // 目标文件名输入更新
  elements.outputFile.addEventListener('input', (e) => {
    currentData.outputFile = e.target.value;
  });

  // 语言选择更新
  elements.language.addEventListener('change', (e) => {
    currentData.language = e.target.value;
  });

  // 配音引擎更新
  document.querySelectorAll('input[name="ttsEngine"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentData.ttsEngine = e.target.value;
    });
  });
}

// 从URL提取域名
function extractDomain(url) {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

async function extractContent() {
  showLoading();

  try {
    const response = await chrome.runtime.sendMessage({ type: 'EXTRACT_CONTENT' });
    console.log('Extract response:', response);

    if (response && response.type === 'EXTRACT_RESULT') {
      currentData = {
        ...currentData,
        ...response.data
      };
      currentDomain = extractDomain(currentData.pageUrl);
      showContentForm();
      updateUI();
    } else if (response && response.type === 'NEED_CONFIG') {
      currentDomain = response.domain;
      showConfigForm();
    } else if (response && response.type === 'EXTRACT_FAILED') {
      showToast(response.error || '提取失败', 'error');
      if (response.data) {
        currentData = { ...currentData, ...response.data };
        currentDomain = extractDomain(response.data.pageUrl);
      }
      showContentForm();
      updateUI();
    } else {
      showToast('未知响应类型', 'error');
      hideLoading();
    }
  } catch (error) {
    console.error('Extract error:', error);
    showToast('无法连接到页面: ' + error.message, 'error');
    hideLoading();
  }
}

function updateUI() {
  // 更新URL显示
  elements.pageUrlPreview.textContent = currentData.pageUrl || '未获取';
  elements.pageUrlFull.textContent = currentData.pageUrl || '未获取';

  elements.videoUrlPreview.textContent = currentData.videoUrl || '未找到';
  elements.videoUrlFull.textContent = currentData.videoUrl || '未找到';

  elements.imageUrlPreview.textContent = currentData.imageUrl || '未找到';
  elements.imageUrlFull.textContent = currentData.imageUrl || '未找到';

  // 更新标题
  elements.pageTitle.value = currentData.pageTitle || '';

  // 更新目标文件名
  elements.outputFile.value = currentData.outputFile || '';

  // 更新语言
  elements.language.value = currentData.language;

  // 更新配音引擎
  const ttsRadio = document.querySelector(`input[name="ttsEngine"][value="${currentData.ttsEngine}"]`);
  if (ttsRadio) {
    ttsRadio.checked = true;
  }
}

function clearData() {
  currentData = {
    pageUrl: '',
    pageTitle: '',
    videoUrl: '',
    imageUrl: '',
    outputFile: '',
    language: 'english',
    ttsEngine: 'minimax',
    isKickstarter: false
  };
}

function showLoading() {
  elements.loadingState.classList.remove('hidden');
  elements.contentForm.classList.add('hidden');
  elements.configForm.classList.add('hidden');
}

function hideLoading() {
  elements.loadingState.classList.add('hidden');
}

function showContentForm() {
  hideLoading();
  elements.contentForm.classList.remove('hidden');
  elements.configForm.classList.add('hidden');
}

function showConfigForm() {
  hideLoading();
  elements.contentForm.classList.add('hidden');
  elements.configForm.classList.remove('hidden');
  elements.configDomain.textContent = currentDomain || '未知';

  // 如果是 kickstarter.com，预填充默认配置
  const isKickstarter = currentDomain && currentDomain.includes('kickstarter.com');
  elements.videoSelectorType.value = isKickstarter ? 'class' : 'id';
  elements.videoSelectorValue.value = isKickstarter ? 'z1' : '';
  elements.imageSelectorType.value = isKickstarter ? 'class' : 'id';
  elements.imageSelectorValue.value = isKickstarter ? 'z3' : '';
}

function generateCommand(isSemiAuto = false) {
  const { pageUrl, videoUrl, imageUrl, pageTitle, outputFile, language, ttsEngine } = currentData;

  if (!videoUrl) {
    return null;
  }

  const titleFlag = language === 'chinese' ? '--chs-title' : '--title';
  let cmd = `recut "${pageUrl}"`;

  // 如果目标文件名不为空，添加 -o 参数（不加引号）
  if (outputFile && outputFile.trim()) {
    cmd += ` -o ${outputFile.trim()}`;
  }

  cmd += ` --video-url "${videoUrl}"`;

  // imageUrl为空时不添加--image参数
  if (imageUrl) {
    cmd += ` --image "${imageUrl}"`;
  }

  cmd += ` ${titleFlag} "${pageTitle}" --tts-engine ${ttsEngine}`;

  if (isSemiAuto) {
    cmd += ' --pause-on-chs-script';
  }

  return cmd;
}

async function copyCommand(isSemiAuto) {
  const cmd = generateCommand(isSemiAuto);

  if (!cmd) {
    showToast('未找到主视频URL，无法生成指令', 'error');
    return;
  }

  try {
    await navigator.clipboard.writeText(cmd);
    showToast('指令已复制到剪贴板', 'success');
  } catch (error) {
    showToast('复制失败，请手动复制', 'error');
  }
}

async function saveRule() {
  const videoSelectorType = elements.videoSelectorType.value;
  const videoSelectorValue = elements.videoSelectorValue.value.trim();
  const imageSelectorType = elements.imageSelectorType.value;
  const imageSelectorValue = elements.imageSelectorValue.value.trim();

  if (!videoSelectorValue) {
    showToast('请输入视频标签选择器', 'error');
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      type: 'SAVE_RULE',
      domain: currentDomain,
      videoSelectorType,
      videoSelectorValue,
      imageSelectorType,
      imageSelectorValue
    });

    showToast('规则已保存', 'success');

    // 重新提取内容
    setTimeout(() => {
      extractContent();
    }, 500);
  } catch (error) {
    showToast('保存失败', 'error');
  }
}

function showToast(message, type = 'info') {
  const toastDiv = elements.toast;
  const toastContent = toastDiv.querySelector('.toast-content');

  toastContent.textContent = message;

  // 设置toast类型样式
  toastDiv.classList.remove('toast-error', 'toast-success');
  if (type === 'error') {
    toastDiv.classList.add('toast-error');
  } else if (type === 'success') {
    toastDiv.classList.add('toast-success');
  }

  toastDiv.classList.remove('hidden');

  setTimeout(() => {
    toastDiv.classList.add('hidden');
  }, 3000);
}
