// shared/constants.js - 跨上下文共享常量（service worker / content script / side panel 共用）
//
// 加载方式：
// - service worker（module）：import '../shared/constants.js'
// - content script：manifest.json 中本文件须先于 content/content.js 声明；
//   service worker 动态注入时同样先注入本文件
// - side panel：<script src="../shared/constants.js"> 须先于 sidepanel.js
//
// 统一挂载到全局 RECUT 命名空间，三种上下文均直接访问。

(function (global) {
  // 消息协议（sidePanel ↔ service worker ↔ content script）
  const MSG = Object.freeze({
    EXTRACT_CONTENT: 'EXTRACT_CONTENT',
    EXTRACT_RESULT: 'EXTRACT_RESULT',
    EXTRACT_FAILED: 'EXTRACT_FAILED',
    NEED_CONFIG: 'NEED_CONFIG',
    SAVE_RULE: 'SAVE_RULE',
    RULE_SAVED: 'RULE_SAVED'
  });

  // chrome.storage.local 键名
  const STORAGE = Object.freeze({
    DOMAIN_RULES: 'domainRules'
  });

  // 无法注入内容脚本的特殊页面 URL 前缀
  const SPECIAL_URL_PREFIXES = Object.freeze([
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:'
  ]);

  function isSpecialUrl(url) {
    return SPECIAL_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
  }

  global.RECUT = Object.freeze({
    MSG,
    STORAGE,
    SPECIAL_URL_PREFIXES,
    isSpecialUrl
  });
})(typeof globalThis !== 'undefined' ? globalThis : self);
