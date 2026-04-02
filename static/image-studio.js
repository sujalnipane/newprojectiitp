// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// image-studio.js
// Flask routes se connected — koi API key frontend mein nahi
// File: static/js/image-studio.js
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let selectedStyle        = "photorealistic";
let uploadedImageBase64  = null;
let uploadedImageType    = null;
const imageHistory       = [];
let toastTimer;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INIT — page load hone pe run hoga
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
document.addEventListener('DOMContentLoaded', () => {
  initStyleChips();
  initFileUpload();
});

function initStyleChips() {
  document.querySelectorAll('.style-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.style-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      selectedStyle = chip.dataset.style;
    });
  });
}

function initFileUpload() {
  const fileInput = document.getElementById('file-input');
  if (fileInput) {
    fileInput.addEventListener('change', handleUpload);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB SWITCH
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active', ['generate', 'edit'][i] === tab);
  });
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + tab).classList.add('active');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GENERATE IMAGE
// POST /api/generate-image → base64 wapas aata hai
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function generateImage() {
  const prompt   = document.getElementById('gen-prompt').value.trim();
  const negative = document.getElementById('gen-negative').value.trim();
  const ratio    = document.getElementById('gen-ratio').value;

  if (!prompt) {
    showToast('❗ Pehle image describe karo', 'error');
    return;
  }

  const [width, height] = ratio.split('x').map(Number);
  const fullPrompt = `${prompt}, ${selectedStyle}${negative ? ', NOT: ' + negative : ''}`;
  const seed       = Math.floor(Math.random() * 99999);

  setLoading('gen', true);

  try {
    const res  = await fetch('/api/generate-image', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ prompt: fullPrompt, width, height, seed })
    });

    const data = await res.json();

    if (data.error) throw new Error(data.error);

    // data_url seedha img src mein daal do
    const img = document.getElementById('gen-result-img');
    img.src          = data.data_url;
    img.style.display = 'block';

    document.getElementById('gen-placeholder').style.display = 'none';
    document.getElementById('gen-spinner').style.display     = 'none';
    document.getElementById('gen-actions').style.display     = 'flex';
    document.getElementById('gen-btn').disabled              = false;

    addToHistory(data.data_url, prompt);
    showToast('✅ Image ready!', 'success');

  } catch (err) {
    setLoading('gen', false);
    showToast('❌ ' + err.message, 'error');
    console.error('Generate error:', err);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE UPLOAD + AUTO ANALYZE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function handleUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast('❗ File 5MB se badi hai', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    uploadedImageBase64 = e.target.result.split(',')[1];
    uploadedImageType   = file.type;

    // Preview dikhao
    const preview         = document.getElementById('upload-preview');
    preview.src           = e.target.result;
    preview.style.display = 'block';

    document.getElementById('upload-badge').style.display = 'block';
    document.getElementById('edit-btn').disabled          = false;

    // Claude se analyze karwao
    analyzeImage();
  };
  reader.readAsDataURL(file);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ANALYZE — Claude Vision
// POST /api/analyze-image
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function analyzeImage() {
  const box  = document.getElementById('analysis-box');
  const text = document.getElementById('analysis-text');

  box.style.display = 'block';
  text.textContent  = '🔍 Claude analyze kar raha hai...';

  try {
    const res  = await fetch('/api/analyze-image', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        image: uploadedImageBase64,
        type:  uploadedImageType
      })
    });

    const data = await res.json();

    text.textContent = data.error
      ? 'Image loaded. Edit instructions likho neeche.'
      : data.analysis;

  } catch {
    text.textContent = 'Image loaded. Describe karo kya change karna hai.';
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EDIT IMAGE
// POST /api/edit-image → Claude prompt banata hai → image generate
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function editImage() {
  if (!uploadedImageBase64) {
    showToast('❗ Pehle image upload karo', 'error');
    return;
  }

  const instruction = document.getElementById('edit-prompt').value.trim();
  if (!instruction) {
    showToast('❗ Edit instruction likho', 'error');
    return;
  }

  const style = document.getElementById('edit-style').value;
  setLoading('edit', true);

  try {
    const res  = await fetch('/api/edit-image', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        image:       uploadedImageBase64,
        type:        uploadedImageType,
        instruction: instruction,
        style:       style
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    // Result dikhao
    const resultImg         = document.getElementById('edit-result-img');
    resultImg.src           = data.data_url;
    resultImg.style.display = 'block';

    document.getElementById('edit-placeholder').style.display = 'none';
    document.getElementById('edit-spinner').style.display     = 'none';
    document.getElementById('edit-btn').disabled              = false;
    document.getElementById('edit-actions').style.display     = 'flex';

    // Before/After compare
    const compareGrid = document.getElementById('compare-grid');
    compareGrid.style.display = 'grid';
    document.getElementById('compare-before').src = `data:${uploadedImageType};base64,${uploadedImageBase64}`;
    document.getElementById('compare-after').src  = data.data_url;

    addToHistory(data.data_url, instruction);
    showToast('✅ Edit ho gaya!', 'success');

  } catch (err) {
    setLoading('edit', false);
    showToast('❌ ' + err.message, 'error');
    console.error('Edit error:', err);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SEND TO EDITOR (Generate → Edit tab)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function sendToEditor() {
  const src = document.getElementById('gen-result-img').src;
  if (!src || src === window.location.href) return;

  // data_url seedha use karo
  if (src.startsWith('data:')) {
    const parts        = src.split(',');
    const mime         = parts[0].split(':')[1].split(';')[0];
    uploadedImageBase64 = parts[1];
    uploadedImageType  = mime;

    const preview         = document.getElementById('upload-preview');
    preview.src           = src;
    preview.style.display = 'block';

    document.getElementById('upload-badge').style.display = 'block';
    document.getElementById('edit-btn').disabled          = false;

    switchTab('edit');
    showToast('📋 Editor mein bhej diya!', 'success');
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DOWNLOAD IMAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function downloadImage(imgId, filename) {
  const img = document.getElementById(imgId);
  if (!img || !img.src || img.style.display === 'none') return;

  const a    = document.createElement('a');
  a.href     = img.src;
  a.download = filename;
  a.click();
  showToast('⬇️ Downloading...', 'success');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HISTORY STRIP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function addToHistory(src, label) {
  imageHistory.unshift({ src, label });
  if (imageHistory.length > 10) imageHistory.pop();

  const strip = document.getElementById('history-strip');
  document.getElementById('history-empty').style.display = 'none';

  strip.querySelectorAll('.history-thumb').forEach(t => t.remove());

  imageHistory.forEach(item => {
    const img       = document.createElement('img');
    img.className   = 'history-thumb';
    img.src         = item.src;
    img.title       = item.label;
    img.onclick     = () => {
      const genImg         = document.getElementById('gen-result-img');
      genImg.src           = item.src;
      genImg.style.display = 'block';
      document.getElementById('gen-placeholder').style.display = 'none';
      document.getElementById('gen-actions').style.display     = 'flex';
      switchTab('generate');
    };
    strip.appendChild(img);
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOADING STATE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function setLoading(panel, loading) {
  const spinner     = document.getElementById(panel + '-spinner');
  const btn         = document.getElementById(panel + '-btn');
  const placeholder = document.getElementById(panel + '-placeholder');
  const resultImg   = document.getElementById(panel + '-result-img');
  const actions     = document.getElementById(panel + '-actions');

  if (loading) {
    spinner.style.display     = 'block';
    placeholder.style.display = 'none';
    resultImg.style.display   = 'none';
    actions.style.display     = 'none';
    btn.disabled              = true;
    btn.textContent           = '⏳ Processing...';
  } else {
    spinner.style.display = 'none';
    btn.disabled          = false;
    btn.textContent       = panel === 'gen' ? '✨ Generate Image' : '🎨 Apply AI Edit';
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOAST NOTIFICATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function showToast(msg, type = '') {
  const t       = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3000);
}
