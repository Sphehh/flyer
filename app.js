// app.js – Main FlyerCraft frontend

// ---------- Netlify Identity ----------
netlifyIdentity.init();
let currentUser = null;
let userCredits = 0;
let currentSpeakerCount = 1;
let speakerImages = {};
let originalImages = {};
let bgRemoving = {};
let currentTemplateId = null;

netlifyIdentity.on('init', user => { updateUIForUser(user); });
netlifyIdentity.on('login', user => { updateUIForUser(user); });
netlifyIdentity.on('logout', () => { updateUIForUser(null); });

// ---------- DOM references ----------
const landing = document.getElementById('landing');
const dashboard = document.getElementById('dashboard');
const editorPanel = document.getElementById('editor-panel');
const resultArea = document.getElementById('result-area');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const creditsDisplay = document.getElementById('credits-display');
const loginModal = document.getElementById('login-modal');
const newProjectBtn = document.getElementById('new-project-btn');

// ---------- Prompt templates (loaded from prompts.json) ----------
let prompts = [];
async function loadPrompts() {
  const res = await fetch('/prompts.json');
  prompts = await res.json();
  renderTemplates();
}
loadPrompts();

// ---------- UI update based on auth state ----------
function updateUIForUser(user) {
  currentUser = user;
  if (user) {
    landing.style.display = 'none';
    dashboard.style.display = 'block';
    editorPanel.style.display = 'none';
    resultArea.style.display = 'none';
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    creditsDisplay.style.display = 'inline-block';
    fetchUserCredits();
    fetchUserProjects();
  } else {
    landing.style.display = 'block';
    dashboard.style.display = 'none';
    editorPanel.style.display = 'none';
    resultArea.style.display = 'none';
    loginBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
    creditsDisplay.style.display = 'none';
  }
}
logoutBtn.addEventListener('click', () => netlifyIdentity.logout());

// ---------- Render template grid on homepage ----------
function renderTemplates() {
  const grid = document.getElementById('templates-grid');
  grid.innerHTML = prompts.map(p => `
    <div class="template-card" data-id="${p.id}">
      <div class="template-thumb">
        <img src="${p.image}" alt="${p.name}" />
      </div>
      <div class="template-info">
        <h3>${p.name}</h3>
        <div class="template-tags">${p.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
      if (!currentUser) {
        loginModal.style.display = 'block';
      } else {
        const templateId = card.dataset.id;
        startEditor(templateId);
      }
    });
  });
}

// ---------- Credits ----------
async function fetchUserCredits() {
  if (!currentUser) return;
  const token = await currentUser.jwt();
  const res = await fetch('/.netlify/functions/user-credits', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  userCredits = data.credits;
  creditsDisplay.textContent = `${userCredits} credits`;
}

async function deductCredits(amount) {
  const token = await currentUser.jwt();
  await fetch('/.netlify/functions/user-credits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: -amount })
  });
  await fetchUserCredits();
}

// ---------- Projects ----------
async function fetchUserProjects() {
  if (!currentUser) return;
  const token = await currentUser.jwt();
  const res = await fetch('/.netlify/functions/user-projects', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return;
  const data = await res.json();
  renderProjects(data);
}
function renderProjects(projects) {
  const list = document.getElementById('projects-list');
  if (!projects || projects.length === 0) {
    list.innerHTML = '<p>No projects yet. Create one to get started!</p>';
    return;
  }
  list.innerHTML = projects.map(p => `
    <div class="project-card">
      <img src="${p.thumbnail}" style="width:100%; border-radius:8px;" />
      <p>${p.template}</p>
    </div>
  `).join('');
}

// ---------- Credit purchase (PayFast) ----------
window.buyCredits = async function(amount) {
  if (!currentUser) {
    alert('Please login first.');
    return;
  }
  const token = await currentUser.jwt();
  const res = await fetch('/.netlify/functions/create-payfast-order', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount })
  });
  const { form } = await res.json();
  const div = document.createElement('div');
  div.innerHTML = form;
  document.body.appendChild(div);
  div.querySelector('form').submit();
};

// ---------- New project = open editor ----------
newProjectBtn.addEventListener('click', () => {
  dashboard.style.display = 'none';
  landing.style.display = 'block';
});

function startEditor(templateId) {
  currentTemplateId = templateId;
  landing.style.display = 'none';
  dashboard.style.display = 'none';
  editorPanel.style.display = 'block';
  resultArea.style.display = 'none';
  buildEditor(templateId);
}

// ---------- Editor construction ----------
function buildEditor(templateId) {
  const prompt = prompts.find(p => p.id === templateId);
  if (!prompt) return;
  
  editorPanel.innerHTML = `
    <div class="editor-header">
      <button class="back-btn" onclick="closeEditor()">← Back</button>
      <div>
        <div class="editor-title">${prompt.name}</div>
        <div style="font-size:0.82rem;color:var(--muted)">Fill in event details</div>
      </div>
    </div>
    <div class="editor-grid">
      <div class="editor-card">
        <h4><span>1</span> Church Info</h4>
        <div class="field"><label>Church Name</label><input type="text" id="f-church-name" placeholder="e.g. Living Chapel Manchester"></div>
        <div class="field"><label>Church Logo (optional)</label><input type="file" id="logo-upload" accept="image/*" onchange="handleLogoUpload(this)"></div>
        <div class="field"><label>Social Media</label><input type="text" id="f-social" placeholder="@yourchurch"></div>
        <div class="field"><label>Theme / Tagline</label><input type="text" id="f-theme" placeholder="e.g. FAITHFUL GOD"></div>
      </div>
      <div class="editor-card">
        <h4><span>2</span> Speakers & People</h4>
        <div class="people-count">
          <label>Number of speakers:</label>
          <button onclick="changeCount(-1)" type="button">−</button>
          <span id="count-display">${prompt.speakers}</span>
          <button onclick="changeCount(1)" type="button">+</button>
        </div>
        <div class="people-grid" id="people-grid"></div>
        <div class="bg-tip">Click ✂️ on each photo to remove background.</div>
        <div id="speaker-names-area"></div>
      </div>
      <div class="editor-card">
        <h4><span>3</span> Event Details</h4>
        <div class="field"><label>Event Title</label><input type="text" id="f-title"></div>
        <div class="field"><label>Date</label><input type="text" id="f-date"></div>
        <div class="field"><label>Time</label><input type="text" id="f-time"></div>
        <div class="field"><label>Venue</label><input type="text" id="f-venue"></div>
        <div class="field" id="host-field"><label>Host Name</label><input type="text" id="f-host"></div>
      </div>
      <div class="editor-card">
        <h4><span>✦</span> Output Settings</h4>
        <div class="field"><label>Aspect Ratio</label>
          <select id="f-ratio"><option>2:3</option><option>1:1</option><option>9:16</option><option>4:5</option></select>
        </div>
        <div class="field"><label>Resolution</label>
          <select id="f-res"><option>1K</option><option selected>2K</option><option>4K</option></select>
        </div>
      </div>
      <div class="generate-area">
        <button class="btn-generate" id="generate-btn" onclick="handleGenerate()">Generate Flyer</button>
      </div>
    </div>
  `;
  currentSpeakerCount = prompt.speakers;
  speakerImages = {};
  originalImages = {};
  bgRemoving = {};
  renderPeopleGrid();
  renderSpeakerNames();
}

window.closeEditor = function() {
  editorPanel.style.display = 'none';
  dashboard.style.display = 'block';
};

window.changeCount = function(delta) {
  currentSpeakerCount = Math.max(1, Math.min(6, currentSpeakerCount + delta));
  document.getElementById('count-display').textContent = currentSpeakerCount;
  renderPeopleGrid();
  renderSpeakerNames();
};

function renderPeopleGrid() {
  const grid = document.getElementById('people-grid');
  grid.innerHTML = Array.from({ length: currentSpeakerCount }).map((_, i) => `
    <div class="person-upload" data-index="${i}">
      <div class="person-thumb" onclick="document.getElementById('person-input-${i}').click()">
        ${speakerImages[i] ? `<img id="person-img-${i}" src="${speakerImages[i]}" />` : `
          <div class="upload-placeholder">
            <div>📷</div>
            <div>Click to upload</div>
          </div>
        `}
      </div>
      <input type="file" id="person-input-${i}" accept="image/*" onchange="handlePersonUpload(this, ${i})" />
      ${speakerImages[i] ? `<button onclick="handleRemoveBackground(${i})" style="width:100%;margin-top:8px;padding:6px;background:#f44336;color:#fff;border:none;border-radius:4px;cursor:pointer;">✂️ Remove BG</button>` : ''}
    </div>
  `).join('');
}

function renderSpeakerNames() {
  const area = document.getElementById('speaker-names-area');
  area.innerHTML = Array.from({ length: currentSpeakerCount }).map((_, i) => `
    <div class="speaker-name-field">
      <input type="text" id="speaker-name-${i}" placeholder="Speaker ${i + 1} name" />
    </div>
  `).join('');
}

window.handlePersonUpload = function(input, index) {
  if (!input.files.length) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = e => {
    speakerImages[index] = e.target.result;
    originalImages[index] = e.target.result;
    renderPeopleGrid();
  };
  reader.readAsDataURL(file);
};

window.handleLogoUpload = function(input) {
  if (!input.files.length) return;
  const file = input.files[0];
  const reader = new FileReader();
  reader.onload = e => {
    speakerImages['logo'] = e.target.result;
  };
  reader.readAsDataURL(file);
};

window.handleRemoveBackground = async function(index) {
  if (!originalImages[index]) return;
  if (bgRemoving[index]) return;
  bgRemoving[index] = true;
  console.log('Background removal for speaker', index, '- placeholder');
  bgRemoving[index] = false;
};

function buildPrompt() {
  const churchName = document.getElementById('f-church-name').value || 'Church';
  const social = document.getElementById('f-social').value || '@church';
  const theme = document.getElementById('f-theme').value || 'Sunday Worship';
  const title = document.getElementById('f-title').value || 'Service';
  const date = document.getElementById('f-date').value || 'TBD';
  const time = document.getElementById('f-time').value || 'TBD';
  const venue = document.getElementById('f-venue').value || 'TBD';
  const host = document.getElementById('f-host')?.value || 'Pastor';

  const speakers = [];
  for (let i = 0; i < currentSpeakerCount; i++) {
    const name = document.getElementById(`speaker-name-${i}`)?.value || `Speaker ${i + 1}`;
    speakers.push(name);
  }

  const prompt = prompts.find(p => p.id === currentTemplateId);
  const basePrompt = prompt?.prompt || '';

  return `
${basePrompt}

--- EVENT DETAILS ---
Church: ${churchName}
Social: ${social}
Theme: ${theme}
Title: ${title}
Date: ${date}
Time: ${time}
Venue: ${venue}
Host: ${host}
Speakers: ${speakers.join(', ')}

Create a professional, beautiful church flyer with these details. Use warm, inviting colors. Include all speaker names prominently.
  `.trim();
}

// ---------- Generation (via serverless function) ----------
window.handleGenerate = async function() {
  if (!currentUser) {
    alert('Please login first.');
    return;
  }
  if (userCredits < 2) {
    alert('You need at least 2 credits. Please buy more.');
    return;
  }
  const promptText = buildPrompt();
  const ratio = document.getElementById('f-ratio').value;
  const res = document.getElementById('f-res').value;

  editorPanel.style.display = 'none';
  resultArea.style.display = 'block';
  document.getElementById('status-text').textContent = 'Generating...';
  document.getElementById('result-img').style.display = 'none';
  document.getElementById('download-actions').style.display = 'none';
  document.getElementById('status-bar').className = 'status-bar';

  const token = await currentUser.jwt();
  try {
    const response = await fetch('/.netlify/functions/generate-flyer', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptText, ratio, resolution: res })
    });
    const data = await response.json();
    if (data.image) {
      document.getElementById('result-img').src = data.image;
      document.getElementById('result-img').style.display = 'block';
      document.getElementById('download-link').href = data.image;
      document.getElementById('download-actions').style.display = 'flex';
      document.getElementById('status-bar').classList.add('done');
      document.getElementById('status-text').textContent = 'Flyer generated!';
      fetchUserCredits();
    } else {
      document.getElementById('status-bar').classList.add('error');
      document.getElementById('status-text').textContent = data.error || 'Generation failed.';
    }
  } catch (error) {
    document.getElementById('status-bar').classList.add('error');
    document.getElementById('status-text').textContent = 'Error: ' + error.message;
  }
};

window.resetToEditor = function() {
  resultArea.style.display = 'none';
  editorPanel.style.display = 'block';
};

window.resetToLanding = function() {
  resultArea.style.display = 'none';
  dashboard.style.display = 'block';
  fetchUserProjects();
};