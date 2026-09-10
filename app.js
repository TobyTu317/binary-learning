/**
 * 二進位互動實驗室 | Binary Interactive Learning Lab
 * Complete interactive logic, Web Audio synthesis, and multi-mode handlers.
 */

(function () {
  'use strict';

  // --- Constants & State ---
  const WEIGHTS = [128, 64, 32, 16, 8, 4, 2, 1];
  const POWERS = [7, 6, 5, 4, 3, 2, 1, 0];
  const LABELS = ['Bit 7 (MSB)', 'Bit 6', 'Bit 5', 'Bit 4', 'Bit 3', 'Bit 2', 'Bit 1', 'Bit 0 (LSB)'];

  const state = {
    bits: [0, 0, 0, 0, 0, 0, 0, 0], // Index 0 = Bit 7 (128), Index 7 = Bit 0 (1)
    currentMode: 1,
    showFormula: false,
    soundEnabled: true,
    quizTarget: null,
    quizStreak: 0,
    theme: localStorage.getItem('binary_theme') || 'dark',
  };

  // --- Web Audio Synthesizer (Zero Dependencies) ---
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    if (!state.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      if (type === 'lever-on') {
        // High click
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.07);
      } else if (type === 'lever-off') {
        // Lower mechanical click
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.06);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'success') {
        // Cheerful major chord arpeggio
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = now + idx * 0.08;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.25, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.36);
        });
      } else if (type === 'error') {
        // Soft double boop
        [220, 180].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = now + idx * 0.12;
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.18, start);
          gain.gain.exponentialRampToValueAtTime(0.01, start + 0.1);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.11);
        });
      }
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  // --- DOM Elements ---
  const bitsGrid = document.getElementById('bitsGrid');
  const decimalTotalEl = document.getElementById('decimalTotal');
  const binaryStringEl = document.getElementById('binaryString');
  const hexStringEl = document.getElementById('hexString');
  const btnToggleFormula = document.getElementById('btnToggleFormula');
  const formulaBtnText = document.getElementById('formulaBtnText');
  const formulaCard = document.getElementById('formulaCard');
  const formulaExpression = document.getElementById('formulaExpression');
  const btnResetAll = document.getElementById('btnResetAll');
  const btnCopyBinary = document.getElementById('btnCopyBinary');

  const btnSoundToggle = document.getElementById('btnSoundToggle');
  const soundIcon = document.getElementById('soundIcon');
  const btnThemeToggle = document.getElementById('btnThemeToggle');
  const themeIcon = document.getElementById('themeIcon');

  // Mode Tabs & Panels
  const modeTabs = document.querySelectorAll('.mode-tab');
  const modePanels = document.querySelectorAll('.mode-panel');

  // Mode 2 Elements
  const converterForm = document.getElementById('converterForm');
  const decInput = document.getElementById('decInput');
  const decRange = document.getElementById('decRange');
  const breakdownSummary = document.getElementById('breakdownSummary');
  const stepsFlow = document.getElementById('stepsFlow');

  // Mode 3 Elements
  const quizTargetNum = document.getElementById('quizTargetNum');
  const streakCountEl = document.getElementById('streakCount');
  const btnNewQuiz = document.getElementById('btnNewQuiz');
  const btnCheckAnswer = document.getElementById('btnCheckAnswer');
  const btnQuizHint = document.getElementById('btnQuizHint');
  const quizFeedback = document.getElementById('quizFeedback');
  const feedbackIcon = document.getElementById('feedbackIcon');
  const feedbackTitle = document.getElementById('feedbackTitle');
  const feedbackDesc = document.getElementById('feedbackDesc');

  // --- Initialization ---
  function init() {
    applyTheme(state.theme);
    renderBitsGrid();
    bindEvents();
    updateUI();
  }

  // --- Render 8-Bit Columns ---
  function renderBitsGrid() {
    bitsGrid.innerHTML = '';

    for (let i = 0; i < 8; i++) {
      const weight = WEIGHTS[i];
      const power = POWERS[i];
      const label = LABELS[i];
      const isOn = state.bits[i] === 1;

      const col = document.createElement('div');
      col.className = `bit-column ${isOn ? 'is-on' : ''}`;
      col.id = `bitCol-${i}`;
      col.setAttribute('data-index', i);

      col.innerHTML = `
        <span class="bit-power-badge">2<sup>${power}</sup></span>
        <span class="bit-value-badge" id="bitVal-${i}">${isOn ? weight : 0}</span>
        <button class="lever-switch-button" id="leverBtn-${i}" aria-label="切換 ${weight} 開關，目前為 ${isOn ? '1' : '0'}" title="點擊切換">
          <img src="${isOn ? 'assets/lever_up.png' : 'assets/lever_down.png'}" alt="拉桿開關" class="lever-img" id="leverImg-${i}">
        </button>
        <span class="bit-state-indicator" id="bitState-${i}">${isOn ? 1 : 0}</span>
        <span class="bit-index-label">${label}</span>
      `;

      bitsGrid.appendChild(col);
    }
  }

  // --- Update UI View based on State ---
  function updateUI() {
    let total = 0;
    let binaryChars = [];

    for (let i = 0; i < 8; i++) {
      const isOn = state.bits[i] === 1;
      const weight = WEIGHTS[i];
      if (isOn) total += weight;
      binaryChars.push(isOn ? '1' : '0');

      // Update Column DOM
      const col = document.getElementById(`bitCol-${i}`);
      const valBadge = document.getElementById(`bitVal-${i}`);
      const leverImg = document.getElementById(`leverImg-${i}`);
      const stateInd = document.getElementById(`bitState-${i}`);
      const leverBtn = document.getElementById(`leverBtn-${i}`);

      if (col) col.classList.toggle('is-on', isOn);
      if (valBadge) valBadge.textContent = isOn ? weight : 0;
      if (leverImg) leverImg.src = isOn ? 'assets/lever_up.png' : 'assets/lever_down.png';
      if (stateInd) stateInd.textContent = isOn ? '1' : '0';
      if (leverBtn) leverBtn.setAttribute('aria-label', `切換 ${weight} 開關，目前為 ${isOn ? '1' : '0'}`);
    }

    // Update Totals
    decimalTotalEl.textContent = total;
    const rawBinary = binaryChars.join('');
    binaryStringEl.textContent = rawBinary.slice(0, 4) + ' ' + rawBinary.slice(4);
    hexStringEl.textContent = '0x' + total.toString(16).toUpperCase().padStart(2, '0');

    // Update Math Formula
    updateFormulaDisplay(total);

    // Sync Mode 2 Slider/Input if in Mode 2
    if (state.currentMode === 2) {
      decInput.value = total;
      decRange.value = total;
      renderBreakdown(total);
    }
  }

  // --- Toggle Bit Action ---
  function toggleBit(index) {
    const newState = state.bits[index] === 1 ? 0 : 1;
    state.bits[index] = newState;
    playSound(newState === 1 ? 'lever-on' : 'lever-off');
    updateUI();
  }

  // --- Set Bits from Integer Value ---
  function setBitsFromDecimal(decimalVal, animate = false) {
    let num = Math.max(0, Math.min(255, Math.floor(decimalVal || 0)));
    const targetBits = [];

    for (let i = 0; i < 8; i++) {
      if (num >= WEIGHTS[i]) {
        targetBits.push(1);
        num -= WEIGHTS[i];
      } else {
        targetBits.push(0);
      }
    }

    if (!animate) {
      state.bits = targetBits;
      updateUI();
      return;
    }

    // Animate sequential lever flips
    targetBits.forEach((bit, idx) => {
      setTimeout(() => {
        if (state.bits[idx] !== bit) {
          state.bits[idx] = bit;
          playSound(bit === 1 ? 'lever-on' : 'lever-off');
          updateUI();
        }
      }, idx * 60);
    });
  }

  // --- Formula Display ---
  function updateFormulaDisplay(total) {
    if (!state.showFormula) return;

    let parts = [];
    for (let i = 0; i < 8; i++) {
      const bit = state.bits[i];
      const weight = WEIGHTS[i];
      const activeClass = bit === 1 ? 'active' : 'inactive';
      parts.push(`<span class="term-bit ${activeClass}">${bit}×${weight}</span>`);
    }

    formulaExpression.innerHTML = parts.join(' + ') + ` <span class="formula-equals">=</span> <span class="formula-result">${total}</span>`;
  }

  // --- Mode 2: Breakdown Explanation ---
  function renderBreakdown(val) {
    let remainder = val;
    stepsFlow.innerHTML = '';
    breakdownSummary.textContent = `${val}₁₀ = ${state.bits.join('')}₂`;

    for (let i = 0; i < 8; i++) {
      const w = WEIGHTS[i];
      const fits = remainder >= w;
      const stepDiv = document.createElement('div');
      stepDiv.className = `step-item ${fits ? 'applied' : ''}`;

      if (fits) {
        stepDiv.innerHTML = `
          <span class="step-badge">Bit ${7 - i} (權重 ${w})：✓ 取 1</span>
          <span>${remainder} ≥ ${w} → 餘數 ${remainder - w}</span>
        `;
        remainder -= w;
      } else {
        stepDiv.innerHTML = `
          <span class="step-badge" style="color: var(--text-muted)">Bit ${7 - i} (權重 ${w})：✗ 取 0</span>
          <span>${remainder} < ${w} → 不足扣除</span>
        `;
      }
      stepsFlow.appendChild(stepDiv);
    }
  }

  // --- Mode 3: Quiz Logic ---
  function startNewQuiz() {
    state.quizTarget = Math.floor(Math.random() * 256);
    quizTargetNum.textContent = state.quizTarget;
    quizFeedback.className = 'quiz-feedback-banner hidden';

    // Reset switches to 0 for a clean challenge
    state.bits = [0, 0, 0, 0, 0, 0, 0, 0];
    updateUI();
  }

  function checkQuizAnswer() {
    if (state.quizTarget === null) {
      startNewQuiz();
      return;
    }

    const currentTotal = state.bits.reduce((sum, b, i) => sum + b * WEIGHTS[i], 0);

    quizFeedback.classList.remove('hidden', 'success', 'error');

    if (currentTotal === state.quizTarget) {
      // Correct!
      state.quizStreak += 1;
      streakCountEl.textContent = state.quizStreak;
      quizFeedback.classList.add('success');
      feedbackIcon.textContent = '🎉';
      feedbackTitle.textContent = '回答完全正確！';
      feedbackDesc.textContent = `太強了！${state.quizTarget} 的二進位表示確實為 ${state.bits.join('')}。繼續保持！`;
      playSound('success');
      triggerConfetti();
    } else {
      // Wrong!
      state.quizStreak = 0;
      streakCountEl.textContent = 0;
      quizFeedback.classList.add('error');
      feedbackIcon.textContent = '🤔';
      feedbackTitle.textContent = '答案不太對喔！';
      const diff = currentTotal - state.quizTarget;
      feedbackDesc.textContent = `你目前撥出的總和是 ${currentTotal}，與目標 ${state.quizTarget} ${diff > 0 ? '多了 ' + diff : '少了 ' + Math.abs(diff)}，請再試一次！`;
      playSound('error');
    }
  }

  function showQuizHint() {
    if (state.quizTarget === null) return;
    const currentTotal = state.bits.reduce((sum, b, i) => sum + b * WEIGHTS[i], 0);

    // Find first mismatched bit from MSB to LSB
    let target = state.quizTarget;
    let expectedBits = [];
    for (let i = 0; i < 8; i++) {
      if (target >= WEIGHTS[i]) {
        expectedBits.push(1);
        target -= WEIGHTS[i];
      } else {
        expectedBits.push(0);
      }
    }

    for (let i = 0; i < 8; i++) {
      if (state.bits[i] !== expectedBits[i]) {
        const action = expectedBits[i] === 1 ? '開啟（扳上去）' : '關閉（扳下去）';
        alert(`💡 提示：請檢查權重為 ${WEIGHTS[i]}（Bit ${7 - i}）的拉桿，它應該要${action}！`);
        return;
      }
    }
    alert('💡 提示：你的拉桿狀態已經完全符合目標了，直接點擊「檢查答案」吧！');
  }

  // --- Confetti Effect for Celebration ---
  function triggerConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#38bdf8', '#ec4899', '#f59e0b', '#10b981', '#a855f7'];

    for (let i = 0; i < 80; i++) {
      pieces.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.7) * 16,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rSpeed: (Math.random() - 0.5) * 10,
      });
    }

    let frame = 0;
    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.4; // gravity
        p.rotation += p.rSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      frame++;
      if (frame < 90) {
        requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    render();
  }

  // --- Themes & Sounds ---
  function applyTheme(theme) {
    state.theme = theme;
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('binary_theme', theme);
    if (themeIcon) themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
  }

  // --- Event Binding ---
  function bindEvents() {
    // Lever clicks (event delegation)
    bitsGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.lever-switch-button');
      if (btn) {
        const col = btn.closest('.bit-column');
        const index = parseInt(col.getAttribute('data-index'), 10);
        toggleBit(index);
      }
    });

    // Formula toggle
    btnToggleFormula.addEventListener('click', () => {
      state.showFormula = !state.showFormula;
      formulaCard.classList.toggle('hidden', !state.showFormula);
      formulaBtnText.textContent = state.showFormula ? '隱藏算式' : '顯示算式';
      if (state.showFormula) {
        const total = state.bits.reduce((sum, b, i) => sum + b * WEIGHTS[i], 0);
        updateFormulaDisplay(total);
      }
    });

    // Reset all bits
    btnResetAll.addEventListener('click', () => {
      state.bits = [0, 0, 0, 0, 0, 0, 0, 0];
      playSound('lever-off');
      updateUI();
    });

    // Copy binary
    btnCopyBinary.addEventListener('click', () => {
      const bin = state.bits.join('');
      navigator.clipboard.writeText(bin).then(() => {
        btnCopyBinary.textContent = '✓';
        setTimeout(() => (btnCopyBinary.textContent = '📋'), 1500);
      });
    });

    // Sound toggle
    btnSoundToggle.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
      btnSoundToggle.querySelector('.btn-text').textContent = state.soundEnabled ? '音效開啟' : '音效靜音';
    });

    // Theme toggle
    btnThemeToggle.addEventListener('click', () => {
      const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
    });

    // Mode tab navigation
    modeTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const mode = parseInt(tab.getAttribute('data-mode'), 10);
        switchMode(mode);
      });
    });

    // Mode 1 Preset Buttons
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-preset');
        if (preset === 'all-on') state.bits = [1, 1, 1, 1, 1, 1, 1, 1];
        else if (preset === 'all-off') state.bits = [0, 0, 0, 0, 0, 0, 0, 0];
        else if (preset === 'invert') state.bits = state.bits.map((b) => (b === 1 ? 0 : 1));
        else if (preset === 'alternating-1') state.bits = [1, 0, 1, 0, 1, 0, 1, 0];
        else if (preset === 'alternating-2') state.bits = [0, 1, 0, 1, 0, 1, 0, 1];
        else if (preset === 'powers') state.bits = [1, 0, 0, 0, 0, 0, 0, 0];
        playSound('lever-on');
        updateUI();
      });
    });

    // Mode 2 Converter form & range slider
    converterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = parseInt(decInput.value, 10) || 0;
      setBitsFromDecimal(val, true);
    });

    decInput.addEventListener('input', (e) => {
      const val = Math.max(0, Math.min(255, parseInt(e.target.value, 10) || 0));
      decRange.value = val;
      setBitsFromDecimal(val, false);
    });

    decRange.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      decInput.value = val;
      setBitsFromDecimal(val, false);
    });

    // Mode 3 Quiz actions
    btnNewQuiz.addEventListener('click', startNewQuiz);
    btnCheckAnswer.addEventListener('click', checkQuizAnswer);
    btnQuizHint.addEventListener('click', showQuizHint);

    // Keyboard navigation (Keys 1-8 to toggle bits directly)
    window.addEventListener('keydown', (e) => {
      if (['input', 'textarea'].includes(document.activeElement.tagName.toLowerCase())) return;
      const key = parseInt(e.key, 10);
      if (key >= 1 && key <= 8) {
        // 1 toggles MSB (128), 8 toggles LSB (1)
        toggleBit(key - 1);
      }
    });
  }

  function switchMode(mode) {
    state.currentMode = mode;

    modeTabs.forEach((tab) => {
      tab.classList.toggle('active', parseInt(tab.getAttribute('data-mode'), 10) === mode);
    });

    modePanels.forEach((panel) => {
      panel.classList.toggle('active', panel.id === `panelMode${mode}`);
    });

    if (mode === 2) {
      const total = state.bits.reduce((sum, b, i) => sum + b * WEIGHTS[i], 0);
      decInput.value = total;
      decRange.value = total;
      renderBreakdown(total);
    } else if (mode === 3) {
      if (state.quizTarget === null) {
        startNewQuiz();
      }
    }
  }

  // Run on DOM loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
