import { NextResponse } from "next/server";

export async function GET() {
  const script = `
(function(){
  var script = document.currentScript;
  var botId = script && script.getAttribute("data-bot-id");
  if(!botId || window.ChatZiWidgetLoaded){ return; }
  window.ChatZiWidgetLoaded = true;
  var apiBase = new URL(script.src).origin;
  var visitorKey = "chatzi_visitor_id";
  var visitorId = localStorage.getItem(visitorKey) || (Date.now().toString(36) + Math.random().toString(36).slice(2));
  localStorage.setItem(visitorKey, visitorId);
  var state = { open:false, conversationId:null, tenantId:null, attachments:[], recorder:null, chunks:[], recording:false };
  
  // Inject style block with zero impact on page layout
  var style = document.createElement("style");
  style.textContent = \`
    .cz-root {
      position: fixed;
      z-index: 2147483000;
      right: 20px;
      bottom: 20px;
      font-family: Cairo, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #1e293b;
      direction: rtl;
      width: auto;
      height: auto;
      pointer-events: none;
      display: flex;
      flex-direction: column-reverse;
      align-items: flex-end;
    }
    .cz-root * {
      box-sizing: border-box;
    }
    .cz-widget-button {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      border: 0;
      background: linear-gradient(135deg, #9b59d0 0%, #7c3aed 100%);
      color: #fff;
      box-shadow: 0 8px 32px rgba(155, 89, 208, 0.4);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      pointer-events: auto;
    }
    .cz-widget-button:hover {
      transform: scale(1.08) translateY(-2px);
      box-shadow: 0 12px 36px rgba(155, 89, 208, 0.5);
    }
    .cz-widget-button svg {
      width: 26px;
      height: 26px;
      fill: currentColor;
    }
    .cz-layout {
      display: flex;
      gap: 12px;
      align-items: flex-end;
      pointer-events: none;
    }
    .cz-personas-sidebar {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 16px;
      opacity: 0;
      transform: translateX(20px);
      transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
      pointer-events: none;
    }
    .cz-personas-sidebar.open {
      opacity: 1;
      transform: translateX(0);
      pointer-events: auto;
    }
    .cz-persona-icon {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #fff;
      border: 1px solid rgba(155, 89, 208, 0.2);
      box-shadow: 0 4px 12px rgba(155, 89, 208, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      transition: all 0.2s;
      color: #7c3aed;
    }
    .cz-persona-icon:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 16px rgba(155, 89, 208, 0.2);
      border-color: #7c3aed;
    }
    .cz-persona-icon svg {
      width: 22px;
      height: 22px;
      fill: currentColor;
    }
    .cz-persona-icon.active {
      background: linear-gradient(135deg, #9b59d0 0%, #7c3aed 100%);
      color: #fff;
    }
    .cz-persona-tooltip {
      position: absolute;
      right: calc(100% + 12px);
      top: 50%;
      transform: translateY(-50%) translateX(10px);
      background: #1e293b;
      color: #fff;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: all 0.2s;
    }
    .cz-persona-icon:hover .cz-persona-tooltip {
      opacity: 1;
      transform: translateY(-50%) translateX(0);
    }
    .cz-persona-tooltip::after {
      content: "";
      position: absolute;
      left: 100%;
      top: 50%;
      transform: translateY(-50%);
      border-width: 5px;
      border-style: solid;
      border-color: transparent transparent transparent #1e293b;
    }
    .cz-panel {
      width: 380px;
      max-width: calc(100vw - 32px);
      height: 600px;
      max-height: calc(100vh - 100px);
      background: #ffffff;
      border: 1px solid rgba(155, 89, 208, 0.1);
      border-radius: 20px;
      box-shadow: 0 20px 50px rgba(132, 61, 176, 0.15);
      overflow: hidden;
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      transform-origin: bottom right;
      transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
      opacity: 0;
      transform: scale(0.85) translateY(20px);
      pointer-events: none;
      position: relative;
    }
    .cz-panel.open {
      opacity: 1;
      transform: scale(1) translateY(0);
      pointer-events: auto;
    }
    .cz-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: linear-gradient(135deg, #9b59d0 0%, #7c3aed 100%);
      color: #fff;
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .cz-header-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .cz-avatar-container {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border: 2px solid rgba(255, 255, 255, 0.4);
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      flex-shrink: 0;
    }
    .cz-avatar-container img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .cz-avatar-container svg {
      width: 22px;
      height: 22px;
      fill: #fff;
    }
    .cz-header-text {
      display: flex;
      flex-direction: column;
    }
    .cz-bot-name {
      font-weight: 700;
      font-size: 15px;
      letter-spacing: -0.2px;
    }
    .cz-bot-status {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      opacity: 0.9;
      margin-top: 2px;
    }
    .cz-status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #4ade80;
      box-shadow: 0 0 8px #4ade80;
      display: inline-block;
    }
    .cz-close-btn {
      border: 0;
      background: transparent;
      color: rgba(255, 255, 255, 0.8);
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px;
      border-radius: 50%;
    }
    .cz-close-btn:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.1);
    }
    .cz-close-btn svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
    }
    .cz-log {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      background: #faf9fc;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .cz-log::-webkit-scrollbar {
      width: 6px;
    }
    .cz-log::-webkit-scrollbar-track {
      background: transparent;
    }
    .cz-log::-webkit-scrollbar-thumb {
      background: #e9d5ff;
      border-radius: 3px;
    }
    .cz-msg-wrapper {
      display: flex;
      gap: 10px;
      align-items: flex-end;
      opacity: 0;
      transform: translateY(10px);
      animation: cz-fade-in 0.3s forwards ease-out;
    }
    @keyframes cz-fade-in {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .cz-msg-wrapper.user {
      flex-direction: row-reverse;
    }
    .cz-msg-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: bold;
      color: #fff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.08);
      overflow: hidden;
      flex-shrink: 0;
    }
    .cz-msg-avatar.user {
      background: #64748b;
    }
    .cz-msg-avatar.assistant {
      background: linear-gradient(135deg, #9b59d0 0%, #7c3aed 100%);
    }
    .cz-msg-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .cz-msg-avatar svg {
      width: 14px;
      height: 14px;
      fill: #fff;
    }
    .cz-msg {
      padding: 12px 16px;
      border-radius: 18px;
      line-height: 1.6;
      max-width: 75%;
      font-size: 13.5px;
      white-space: pre-wrap;
      box-shadow: 0 2px 12px rgba(155, 89, 208, 0.04);
      position: relative;
    }
    .cz-msg.user {
      background: linear-gradient(135deg, #9b59d0 0%, #843db0 100%);
      color: #fff;
      border-bottom-right-radius: 4px;
      box-shadow: 0 4px 12px rgba(155, 89, 208, 0.2);
    }
    .cz-msg.assistant {
      background: #ffffff;
      color: #1e293b;
      border: 1px solid rgba(155, 89, 208, 0.08);
      border-bottom-left-radius: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
    }
    .cz-audio-player {
      margin-top: 6px;
      border-radius: 12px;
      outline: none;
      height: 36px;
      width: 210px;
      display: block;
    }
    .cz-msg.user .cz-audio-player {
      filter: invert(1) hue-rotate(180deg);
    }
    .cz-suggestions {
      padding: 12px 16px;
      background: #ffffff;
      border-top: 1px solid rgba(155, 89, 208, 0.06);
      display: flex;
      gap: 8px;
      overflow-x: auto;
      white-space: nowrap;
      scrollbar-width: none;
    }
    .cz-suggestions::-webkit-scrollbar {
      display: none;
    }
    .cz-suggest-pill {
      background: #f5f0fa;
      border: 1px solid rgba(155, 89, 208, 0.12);
      color: #9b59d0;
      border-radius: 20px;
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: inherit;
      flex-shrink: 0;
      box-shadow: 0 2px 6px rgba(155, 89, 208, 0.04);
    }
    .cz-suggest-pill:hover {
      background: #9b59d0;
      color: #ffffff;
      border-color: #9b59d0;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(155, 89, 208, 0.2);
    }
    .cz-attachments {
      padding: 10px 16px;
      border-top: 1px solid rgba(155, 89, 208, 0.08);
      background: #fbfbfd;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .cz-attachment-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #f5f0fa;
      color: #9b59d0;
      border: 1px solid rgba(155, 89, 208, 0.12);
      border-radius: 12px;
      padding: 4px 10px;
      font-size: 11.5px;
      font-weight: 500;
    }
    .cz-attachment-badge svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }
    .cz-attachment-remove {
      border: 0;
      background: transparent;
      color: #94a3b8;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2px;
      border-radius: 50%;
      transition: all 0.2s;
    }
    .cz-attachment-remove:hover {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.08);
    }
    .cz-form {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px;
      border-top: 1px solid rgba(155, 89, 208, 0.08);
      background: #fff;
    }
    .cz-input-wrapper {
      flex: 1;
      display: flex;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 24px;
      padding: 4px 14px;
      transition: all 0.25s ease;
    }
    .cz-input-wrapper:focus-within {
      border-color: #9b59d0;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(155, 89, 208, 0.15);
    }
    .cz-input {
      flex: 1;
      resize: none;
      border: 0;
      background: transparent;
      padding: 8px 0;
      outline: none;
      font-size: 13.5px;
      line-height: 1.5;
      max-height: 80px;
      font-family: inherit;
      color: #1e293b;
    }
    .cz-btn-audio, .cz-btn-image {
      border: 0;
      background: transparent;
      color: #64748b;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      padding: 6px;
      border-radius: 50%;
    }
    .cz-btn-audio:hover, .cz-btn-image:hover {
      color: #9b59d0;
      background: rgba(155, 89, 208, 0.08);
    }
    .cz-btn-audio svg, .cz-btn-image svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
    }
    .cz-btn-audio.recording {
      color: #ef4444;
      animation: cz-pulse-red 1.5s infinite;
      background: rgba(239, 68, 68, 0.1);
    }
    @keyframes cz-pulse-red {
      0% { transform: scale(1); }
      50% { transform: scale(1.1); box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2); }
      100% { transform: scale(1); }
    }
    .cz-btn-submit {
      border: 0;
      border-radius: 50%;
      background: linear-gradient(135deg, #9b59d0 0%, #843db0 100%);
      color: #fff;
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
      flex-shrink: 0;
      box-shadow: 0 4px 10px rgba(155, 89, 208, 0.25);
    }
    .cz-btn-submit:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 14px rgba(155, 89, 208, 0.35);
    }
    .cz-btn-submit svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
      transform: rotate(180deg);
    }
    .cz-image-preview {
      display: block;
      max-width: 220px;
      max-height: 180px;
      border-radius: 12px;
      margin-top: 8px;
      object-fit: cover;
      border: 1px solid rgba(148, 163, 184, 0.25);
    }
    .cz-typing-indicator {
      display: flex;
      align-items: center;
      gap: 4px;
      background: #ffffff;
      border: 1px solid rgba(155, 89, 208, 0.08);
      border-radius: 16px;
      border-bottom-left-radius: 4px;
      padding: 12px 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.01);
      width: fit-content;
    }
    .cz-typing-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #9b59d0;
      animation: cz-bounce 1.4s infinite ease-in-out both;
    }
    .cz-typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .cz-typing-dot:nth-child(2) { animation-delay: -0.16s; }
    @keyframes cz-bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
  \`;
  document.head.appendChild(style);

  var root = document.createElement("div");
  root.className = "cz-root";
  root.innerHTML = '<button aria-label="Chat" class="cz-widget-button" data-cz-toggle><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg></button><div class="cz-layout"><div class="cz-personas-sidebar" data-cz-sidebar></div><section class="cz-panel" data-cz-panel><header class="cz-header"><div class="cz-header-info"><div class="cz-avatar-container" data-cz-avatar-container><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg></div><div class="cz-header-text"><div class="cz-bot-name" data-cz-title>مساعد ChatZi</div><div class="cz-bot-status"><span class="cz-status-dot"></span>متصل الآن</div></div></div><button class="cz-close-btn" data-cz-close><svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg></button></header><div class="cz-log" data-cz-log></div><div class="cz-suggestions" data-cz-suggests style="display:none"></div><div class="cz-attachments" data-cz-attachments style="display:none"></div><form class="cz-form" data-cz-form><div class="cz-input-wrapper"><textarea class="cz-input" data-cz-input rows="1" placeholder="اكتب رسالتك..."></textarea><input type="file" accept="image/*" data-cz-image-input style="display:none" /><button type="button" title="إرسال صورة" class="cz-btn-image" data-cz-image><svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 11.5l2.5 3.01L14.5 10l4.5 6H5l3.5-4.5z"/></svg></button><button type="button" title="رسالة صوتية" class="cz-btn-audio" data-cz-audio><svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg></button></div><button class="cz-btn-submit"><svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button></form></section></div>';
  document.body.appendChild(root);

  var panel = root.querySelector("[data-cz-panel]");
  var toggle = root.querySelector("[data-cz-toggle]");
  var close = root.querySelector("[data-cz-close]");
  var form = root.querySelector("[data-cz-form]");
  var input = root.querySelector("[data-cz-input]");
  var log = root.querySelector("[data-cz-log]");
  var filesBox = root.querySelector("[data-cz-attachments]");
  var audioButton = root.querySelector("[data-cz-audio]");
  var imageButton = root.querySelector("[data-cz-image]");
  var imageInput = root.querySelector("[data-cz-image-input]");
  var suggestsBox = root.querySelector("[data-cz-suggests]");
  var sidebarBox = root.querySelector("[data-cz-sidebar]");
  var typingIndicator = null;
  var personasData = [];

  function add(sender, text, audioUrl, imageUrl) {
    var wrapper = document.createElement("div");
    wrapper.className = "cz-msg-wrapper " + (sender === "user" ? "user" : "assistant");
    
    var avatar = document.createElement("div");
    avatar.className = "cz-msg-avatar " + (sender === "user" ? "user" : "assistant");
    avatar.innerHTML = sender === "user" 
      ? "👤" 
      : (root.querySelector("[data-cz-avatar-container] img") 
          ? '<img src="' + root.querySelector("[data-cz-avatar-container] img").src + '">' 
          : '<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:#fff"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>');
    
    var bubble = document.createElement("div");
    bubble.className = "cz-msg " + (sender === "user" ? "user" : "assistant");
    
    if (text) {
      var p = document.createElement("p");
      p.textContent = text;
      p.style.margin = "0";
      bubble.appendChild(p);
    }
    
    if (imageUrl) {
      var img = document.createElement("img");
      img.src = imageUrl;
      img.alt = "image attachment";
      img.className = "cz-image-preview";
      bubble.appendChild(img);
    }

    if (audioUrl) {
      var aud = document.createElement("audio");
      aud.src = audioUrl;
      aud.controls = true;
      aud.className = "cz-audio-player";
      bubble.appendChild(aud);
    }
    
    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    log.appendChild(wrapper);
    log.scrollTop = log.scrollHeight;
  }

  function showTyping() {
    if (typingIndicator) return;
    typingIndicator = document.createElement("div");
    typingIndicator.className = "cz-msg-wrapper assistant";
    
    var avatarHtml = root.querySelector("[data-cz-avatar-container] img")
      ? '<img src="' + root.querySelector("[data-cz-avatar-container] img").src + '">'
      : '<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:#fff"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>';
      
    typingIndicator.innerHTML = '<div class="cz-msg-avatar assistant">' + avatarHtml + '</div><div class="cz-typing-indicator"><span class="cz-typing-dot"></span><span class="cz-typing-dot"></span><span class="cz-typing-dot"></span></div>';
    log.appendChild(typingIndicator);
    log.scrollTop = log.scrollHeight;
  }

  function hideTyping() {
    if (typingIndicator) {
      typingIndicator.remove();
      typingIndicator = null;
    }
  }

  function renderFiles() {
    if (!state.attachments.length) {
      filesBox.style.display = "none";
      filesBox.innerHTML = "";
      return;
    }
    filesBox.style.display = "flex";
    filesBox.innerHTML = "";
    state.attachments.forEach(function(att, idx) {
      var badge = document.createElement("div");
      badge.className = "cz-attachment-badge";
      var iconPath = att.type === "image" ? "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 11.5l2.5 3.01L14.5 10l4.5 6H5l3.5-4.5z" : "M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z";
      badge.innerHTML = '<svg viewBox="0 0 24 24"><path d="' + iconPath + '"/></svg><span>' + att.name + "</span>";
      
      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "cz-attachment-remove";
      removeBtn.innerHTML = "×";
      removeBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        state.attachments.splice(idx, 1);
        renderFiles();
      });
      
      badge.appendChild(removeBtn);
      filesBox.appendChild(badge);
    });
  }

  function fileToDataUrl(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function() { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function start() {
    if (state.conversationId) return;
    var res = await fetch(apiBase + "/api/widget/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botId: botId, visitorId: visitorId })
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || "تعذر بدء المحادثة");
    state.conversationId = data.conversationId;
    state.tenantId = data.tenantId;
    
    if (data.bot) {
      if (data.bot.name) {
        root.querySelector("[data-cz-title]").textContent = data.bot.name;
      }
      if (data.bot.avatar) {
        var avatarContainer = root.querySelector("[data-cz-avatar-container]");
        avatarContainer.innerHTML = '<img src="' + data.bot.avatar + '" alt="' + (data.bot.name || "") + '">';
      }
    }
    
    // Save personas
    if (data.personas && data.personas.length) {
      personasData = data.personas;
      renderSidebar(personasData, data.bot, data.suggestions);
    }
    
    // Welcome message
    var welcomeName = (data.bot && data.bot.name) || "ChatZi";
    var personaHint = data.personas && data.personas.length ? "\n\nيمكنك اختيار أحد الموظفين الآليين من الأيقونات الجانبية، أو اكتب طلبك مباشرة." : "";
    add("assistant", "وعليكم السلام ورحمة الله وبركاته. أنا المساعد الذكي لـ " + welcomeName + ". كيف أقدر أساعدك اليوم؟" + personaHint);
    
    // Render suggestions
    renderSuggestions(data.suggestions);
  }

  function renderSuggestions(suggestionsArray) {
    if (suggestionsArray && suggestionsArray.length) {
      suggestsBox.style.display = "flex";
      suggestsBox.innerHTML = "";
      suggestionsArray.forEach(function(s) {
        var pill = document.createElement("button");
        pill.type = "button";
        pill.className = "cz-suggest-pill";
        pill.textContent = s;
        pill.addEventListener("click", function() {
          input.value = s;
          var submitEvent = new Event("submit", { cancelable: true });
          form.dispatchEvent(submitEvent);
        });
        suggestsBox.appendChild(pill);
      });
    } else {
      suggestsBox.style.display = "none";
    }
  }

  function renderSidebar(personas, botObj, baseSuggestions) {
    sidebarBox.innerHTML = "";
    if (!personas || personas.length === 0) return;
    
    // Default bot icon (active initially)
    var defaultIcon = document.createElement("div");
    defaultIcon.className = "cz-persona-icon active";
    defaultIcon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg><div class="cz-persona-tooltip">المساعد العام</div>';
    
    defaultIcon.addEventListener("click", function() {
      // Clear log and switch context
      log.innerHTML = "";
      root.querySelectorAll(".cz-persona-icon").forEach(function(el) { el.classList.remove("active"); });
      defaultIcon.classList.add("active");
      root.querySelector("[data-cz-title]").textContent = botObj.name || "مساعد ChatZi";
      add("assistant", "وعليكم السلام ورحمة الله وبركاته. أنا المساعد الذكي لـ " + (botObj.name || "ChatZi") + ". كيف أقدر أساعدك اليوم؟");
      renderSuggestions(baseSuggestions);
    });
    sidebarBox.appendChild(defaultIcon);

    // Dynamic Employee Icons
    personas.forEach(function(p) {
      var icon = document.createElement("div");
      icon.className = "cz-persona-icon";
      // Use Users icon
      icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><div class="cz-persona-tooltip">' + p.roleName + '</div>';
      
      icon.addEventListener("click", async function() {
        // Visually switch
        root.querySelectorAll(".cz-persona-icon").forEach(function(el) { el.classList.remove("active"); });
        icon.classList.add("active");
        
        // Update Header
        root.querySelector("[data-cz-title]").textContent = p.roleName;
        
        // Clear log
        log.innerHTML = "";
        
        // Send a silent payload to switch persona on backend
        try {
          await fetch(apiBase + "/api/widget/message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              botId: botId,
              conversationId: state.conversationId,
              visitorId: visitorId,
              message: "SELECT_PERSONA_" + p.id
            })
          });
        } catch(e) {}

        // Add persona greeting
        add("assistant", p.greetingMessage || "أهلاً بك! أنا " + p.roleName + ". كيف يمكنني مساعدتك؟");
        
        // Render persona specific suggestions
        // A simple heuristic for suggestions based on description or general role
        var specificSuggestions = [
          "ما هي الأسئلة الشائعة حول " + p.roleName + "؟",
          "أحتاج مساعدة في مهام " + p.roleName
        ];
        renderSuggestions(specificSuggestions);
      });
      sidebarBox.appendChild(icon);
    });
  }

  async function setOpen(value) {
    state.open = value;
    if (value) {
      panel.classList.add("open");
      sidebarBox.classList.add("open");
      // Change toggle icon to X
      toggle.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
      try {
        await start();
      } catch (e) {
        // Only show error if no messages exist
        if (!root.querySelector(".cz-msg-wrapper")) {
          add("assistant", e.message);
        }
      }
    } else {
      panel.classList.remove("open");
      sidebarBox.classList.remove("open");
      // Revert toggle icon to chat bubble
      toggle.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>';
    }
  }

  // Draggable floating button physics
  var isDragging = false;
  var startX, startY;
  var initialLeft, initialTop;
  var dragThreshold = 5;
  var hasMoved = false;

  function onMouseDown(e) {
    if (e.type === "mousedown" && e.button !== 0) return;
    
    isDragging = true;
    hasMoved = false;
    
    var clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
    var clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;
    
    startX = clientX;
    startY = clientY;
    
    var rootRect = root.getBoundingClientRect();
    initialLeft = rootRect.left;
    initialTop = rootRect.top;
    
    root.style.transition = "none";
    
    if (e.type === "mousedown") {
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    } else {
      document.addEventListener("touchmove", onTouchMove, { passive: false });
      document.addEventListener("touchend", onTouchEnd);
    }
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    
    var clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
    var clientY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;
    
    var dx = clientX - startX;
    var dy = clientY - startY;
    
    if (!hasMoved && (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold)) {
      hasMoved = true;
    }
    
    if (hasMoved) {
      var newLeft = initialLeft + dx;
      var newBottom = window.innerHeight - (initialTop + root.offsetHeight) - dy;
      
      var maxLeft = window.innerWidth - root.offsetWidth;
      var maxBottom = window.innerHeight - root.offsetHeight;
      
      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newBottom = Math.max(0, Math.min(newBottom, maxBottom));
      
      root.style.right = "auto";
      root.style.top = "auto";
      root.style.left = newLeft + "px";
      root.style.bottom = newBottom + "px";
    }
    
    if (e.type === "touchmove") {
      e.preventDefault();
    }
  }

  function onMouseUp() {
    isDragging = false;
    root.style.transition = "";
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  function onTouchEnd() {
    isDragging = false;
    root.style.transition = "";
    document.removeEventListener("touchmove", onTouchMove);
    document.removeEventListener("touchend", onTouchEnd);
  }

  function onTouchMove(e) {
    onMouseMove(e);
  }

  toggle.addEventListener("mousedown", onMouseDown);
  toggle.addEventListener("touchstart", onMouseDown, { passive: true });

  toggle.addEventListener("click", function(e) {
    if (hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    setOpen(!state.open);
  });

  close.addEventListener("click", function() { setOpen(false); });

  imageButton.addEventListener("click", function() {
    imageInput.click();
  });

  imageInput.addEventListener("change", async function() {
    var file = imageInput.files && imageInput.files[0];
    imageInput.value = "";
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) {
      add("assistant", "من فضلك اختر صورة فقط.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      add("assistant", "حجم الصورة كبير. الحد الحالي 2MB.");
      return;
    }
    var dataUrl = await fileToDataUrl(file);
    state.attachments.push({ type: "image", name: file.name || "image", dataUrl: dataUrl, mimeType: file.type, size: file.size });
    renderFiles();
  });

  // Voice recording
  audioButton.addEventListener("click", async function() {
    try {
      if (state.recording && state.recorder) {
        state.recorder.stop();
        return;
      }
      var stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.chunks = [];
      state.recorder = new MediaRecorder(stream);
      state.recorder.ondataavailable = function(e) { state.chunks.push(e.data); };
      state.recorder.onstop = async function() {
        stream.getTracks().forEach(function(t) { t.stop(); });
        var blob = new Blob(state.chunks, { type: "audio/webm" });
        var dataUrl = await fileToDataUrl(new File([blob], "voice.webm", { type: "audio/webm" }));
        state.attachments.push({ type: "audio", name: "تسجيل صوتي.webm", dataUrl: dataUrl });
        state.recording = false;
        audioButton.classList.remove("recording");
        renderFiles();
      };
      state.recording = true;
      audioButton.classList.add("recording");
      state.recorder.start();
    } catch (e) {
      add("assistant", "تعذر تشغيل الميكروفون من المتصفح.");
    }
  });

  // Enter to send
  input.addEventListener("keydown", function(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      var submitEvent = new Event("submit", { cancelable: true });
      form.dispatchEvent(submitEvent);
    }
  });

  // Form submit
  form.addEventListener("submit", async function(event) {
    event.preventDefault();
    var text = input.value.trim();
    if (!text && !state.attachments.length) return;
    input.value = "";
    
    var attachments = state.attachments.slice();
    state.attachments = [];
    renderFiles();
    
    var audioAtt = attachments.find(function(a) { return a.type === "audio"; });
    var imageAtt = attachments.find(function(a) { return a.type === "image"; });
    var audioUrl = audioAtt ? audioAtt.dataUrl : null;
    var imageUrl = imageAtt ? imageAtt.dataUrl : null;
    
    add("user", text, audioUrl, imageUrl);
    showTyping();
    
    try {
      await start();
      var res = await fetch(apiBase + "/api/widget/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: state.tenantId,
          botId: botId,
          conversationId: state.conversationId,
          visitorId: visitorId,
          message: text || "أرسل لك مقطع صوتي.",
          attachments: attachments
        })
      });
      var data = await res.json();
      hideTyping();
      if (data.reply) {
        add("assistant", data.reply);
      } else {
        var errText = data.error || "تعذر الرد الآن.";
        if (errText.includes("429") || errText.includes("quota") || errText.includes("Quota")) {
          add("assistant", "⚠️ تجاوزت حصة Gemini المجانية. احصل على مفتاح مدفوع من aistudio.google.com/apikey أو أضف مفتاح OpenAI.");
        } else {
          add("assistant", errText);
        }
      }
    } catch (e) {
      hideTyping();
      add("assistant", e.message);
    }
  });
})();`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300"
    }
  });
}