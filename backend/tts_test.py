"""TTS test page — standalone HTML page for debugging pronunciation issues."""
from fastapi.responses import HTMLResponse
from fastapi import APIRouter

router = APIRouter()


@router.get("/tts-test", response_class=HTMLResponse)
def tts_test_page():
    return """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TTS 诊断测试</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; background: #f8fafc; color: #1e293b; }
  h1 { color: #0d9488; }
  .card { background: #fff; border-radius: 12px; padding: 20px; margin: 16px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
  button { background: #14b8a6; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; cursor: pointer; margin: 8px 8px 8px 0; transition: background 0.2s; }
  button:hover { background: #0d9488; }
  button.secondary { background: #8b5cf6; }
  button.secondary:hover { background: #7c3aed; }
  .log { background: #1e293b; color: #4ade80; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 13px; max-height: 300px; overflow-y: auto; margin-top: 16px; }
  .log .error { color: #f87171; }
  .log .info { color: #93c5fd; }
  .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
  .status.ok { background: #d1fae5; color: #065f46; }
  .status.fail { background: #fee2e2; color: #991b1b; }
  input { padding: 10px 14px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 16px; width: 200px; }
</style>
</head>
<body>
<h1>🔊 TTS 发音诊断</h1>

<div class="card">
  <h3>环境检测</h3>
  <p>speechSynthesis 支持: <span id="ss-support" class="status"></span></p>
  <p>安全上下文 (HTTPS/localhost): <span id="secure-ctx" class="status"></span></p>
  <p>可用语音数量: <span id="voice-count" style="font-weight:bold;color:#0d9488"></span></p>
  <p>当前主机: <span id="host" style="font-weight:bold"></span></p>
</div>

<div class="card">
  <h3>测试发音</h3>
  <p>输入要测试的单词: <input id="word-input" value="hello" /></p>
  <button onclick="testSpeechSynthesis()">测试浏览器语音</button>
  <button class="secondary" onclick="testYoudaoAudio()">测试有道词典音频</button>
  <button class="secondary" onclick="testAuto()">自动检测并播放</button>
</div>

<div class="card">
  <h3>语音列表</h3>
  <div id="voice-list" style="font-size:13px;color:#64748b"></div>
</div>

<div class="log" id="log">等待测试...<br></div>

<script>
function log(msg, type) {
  const el = document.getElementById('log');
  const cls = type === 'error' ? 'error' : (type === 'info' ? 'info' : '');
  el.innerHTML += '<span class="' + cls + '">[' + new Date().toLocaleTimeString() + '] ' + msg + '</span><br>';
  el.scrollTop = el.scrollHeight;
}

// Environment detection
const ssSupport = typeof window.speechSynthesis !== 'undefined';
const secureCtx = window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
document.getElementById('ss-support').textContent = ssSupport ? '✅ 支持' : '❌ 不支持';
document.getElementById('ss-support').className = 'status ' + (ssSupport ? 'ok' : 'fail');
document.getElementById('secure-ctx').textContent = secureCtx ? '✅ 是' : '❌ 否 (IP访问)';
document.getElementById('secure-ctx').className = 'status ' + (secureCtx ? 'ok' : 'fail');
document.getElementById('host').textContent = location.host;

function updateVoices() {
  if (!ssSupport) {
    document.getElementById('voice-count').textContent = '0 (不支持)';
    document.getElementById('voice-list').textContent = '浏览器不支持 speechSynthesis';
    return;
  }
  const voices = speechSynthesis.getVoices();
  const enVoices = voices.filter(v => v.lang.startsWith('en'));
  document.getElementById('voice-count').textContent = voices.length + ' 个 (英文: ' + enVoices.length + ')';
  document.getElementById('voice-list').innerHTML = enVoices.length > 0
    ? enVoices.map(v => '• ' + v.name + ' (' + v.lang + ')').join('<br>')
    : '<span style="color:#ef4444">⚠️ 没有英文语音! 这就是浏览器语音不发声的原因</span>';
}
updateVoices();
if (ssSupport) {
  speechSynthesis.addEventListener('voiceschanged', updateVoices);
  // Some browsers need a delay
  setTimeout(updateVoices, 500);
  setTimeout(updateVoices, 2000);
}

function testSpeechSynthesis() {
  const word = document.getElementById('word-input').value || 'hello';
  log('--- 测试浏览器语音: "' + word + '" ---', 'info');

  if (!ssSupport) {
    log('❌ 浏览器不支持 speechSynthesis', 'error');
    return;
  }

  if (!secureCtx) {
    log('❌ 非安全上下文，speechSynthesis 可能被限制', 'error');
  }

  const voices = speechSynthesis.getVoices();
  const enVoices = voices.filter(v => v.lang.startsWith('en'));
  log('英文语音数量: ' + enVoices.length);

  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = 'en-US';
  u.rate = 0.9;

  u.onstart = () => log('✅ 语音开始播放');
  u.onend = () => log('✅ 语音播放结束');
  u.onerror = (e) => log('❌ 语音错误: ' + e.error, 'error');

  log('正在调用 speechSynthesis.speak()...');
  speechSynthesis.speak(u);

  // Check after 1s if it started
  setTimeout(() => {
    if (!speechSynthesis.speaking && !speechSynthesis.pending) {
      log('⚠️ 1秒后语音仍未开始 — 可能被浏览器静默阻止', 'error');
      log('💡 建议使用"测试有道词典音频"按钮', 'info');
    }
  }, 1000);
}

function testYoudaoAudio() {
  const word = document.getElementById('word-input').value || 'hello';
  log('--- 测试有道词典音频: "' + word + '" ---', 'info');

  const url = 'https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(word) + '&type=1';
  log('请求 URL: ' + url);

  const audio = new Audio(url);
  audio.volume = 1;

  audio.oncanplay = () => log('✅ 音频已加载，准备播放');
  audio.onplaying = () => log('✅ 音频开始播放');
  audio.onended = () => log('✅ 音频播放结束');
  audio.onerror = () => log('❌ 音频加载失败', 'error');

  log('正在播放...');
  audio.play().then(() => {
    log('✅ audio.play() 成功');
  }).catch(e => {
    log('❌ audio.play() 失败: ' + e.message, 'error');
    log('💡 浏览器可能需要用户交互才能播放音频', 'info');
  });
}

function testAuto() {
  const word = document.getElementById('word-input').value || 'hello';
  log('=== 自动检测模式 ===', 'info');

  if (secureCtx && ssSupport) {
    log('安全上下文 + speechSynthesis 支持 → 尝试浏览器语音', 'info');
    testSpeechSynthesis();
    setTimeout(() => {
      if (!speechSynthesis.speaking) {
        log('浏览器语音未生效，切换到有道词典...', 'info');
        testYoudaoAudio();
      }
    }, 1500);
  } else {
    log('非安全上下文或不支持 → 直接使用有道词典', 'info');
    testYoudaoAudio();
  }
}
</script>
</body>
</html>"""
