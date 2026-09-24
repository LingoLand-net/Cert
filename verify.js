/* Lingo‑Ville — public certificate verification */
(function () {
  const CFG = window.VERIFY_CONFIG;

  if (window.pdfjsLib && CFG.PDFJS_WORKER) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = CFG.PDFJS_WORKER;
  }

  const $ = (id) => document.getElementById(id);
  const sections = {
    search:  $('searchState'),
    loading: $('loadingState'),
    result:  $('resultState'),
    error:   $('errorState')
  };

  function showOnly(name) {
    Object.values(sections).forEach(s => s.classList.add('hidden'));
    sections[name].classList.remove('hidden');
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function fmtDate(d) {
    if (!d) return '—';
    try {
      const dt = (d instanceof Date) ? d : new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (_) { return String(d); }
  }

  function showToast(message, duration = 2400) {
    const t = $('toast');
    if (!t) return;
    t.textContent = message;
    t.classList.add('show');
    clearTimeout(t._to);
    t._to = setTimeout(() => t.classList.remove('show'), duration);
  }

  const CERT_CACHE_TTL_MS = 5 * 60 * 1000;
  const CERT_CACHE_PREFIX = 'lv_cert_';

  function readCertCache(certId) {
    try {
      const raw = localStorage.getItem(CERT_CACHE_PREFIX + certId);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.data || !parsed.at) return null;
      if (Date.now() - parsed.at > CERT_CACHE_TTL_MS) {
        localStorage.removeItem(CERT_CACHE_PREFIX + certId);
        return null;
      }
      return parsed.data;
    } catch (_) { return null; }
  }

  function writeCertCache(certId, data) {
    try {
      localStorage.setItem(CERT_CACHE_PREFIX + certId, JSON.stringify({ data, at: Date.now() }));
    } catch (_) {}
  }

  function parseHash() {
    const raw = (window.location.hash || '').replace(/^#!?\/?/, '').trim();
    return raw ? decodeURIComponent(raw).toLowerCase() : '';
  }

  function setHash(certId) {
    const next = `#/${encodeURIComponent(certId)}`;
    if (window.location.hash !== next) {
      window.location.hash = next;
    } else {
      handleRoute();
    }
  }

  function clearHash() {
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname);
    }
  }

  async function fetchCert(certId) {
    const url = `${CFG.APPS_SCRIPT_URL}?action=getCert&id=${encodeURIComponent(certId)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('NETWORK_' + res.status);
    const json = await res.json();
    if (json.status !== 'success') throw new Error(json.message || 'LOOKUP_FAILED');
    return json.data;
  }

  async function renderPdf(container, url) {
    container.innerHTML = '';
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const renderScale = isMobile ? 1.25 : 1.5;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('FETCH_' + res.status);
      const buf = await res.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const pagesToRender = isMobile ? 1 : pdf.numPages;

      for (let i = 1; i <= pagesToRender; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: renderScale });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        container.appendChild(canvas);
        await page.render({ canvasContext: ctx, viewport }).promise;
      }

      if (isMobile) {
        const canvas = container.querySelector('canvas');
        if (canvas) {
          const wrapper = document.createElement('a');
          wrapper.href = url;
          wrapper.target = '_blank';
          wrapper.rel = 'noopener';
          wrapper.className = 'block relative cursor-pointer';
          container.removeChild(canvas);
          wrapper.appendChild(canvas);
          const pill = document.createElement('div');
          pill.className = 'absolute top-3 right-3 bg-white/95 text-slate-800 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg pointer-events-none';
          pill.innerHTML = `
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Tap to open
          `;
          wrapper.appendChild(pill);
          container.appendChild(wrapper);
          const hint = document.createElement('p');
          hint.className = 'text-xs text-slate-400 text-center mt-3';
          hint.textContent = 'Opens in your device PDF viewer';
          container.appendChild(hint);
        }
      }
      return;
    } catch (err) {
      console.warn('PDF.js failed, falling back to direct link:', err);
    }

    container.innerHTML = `
      <a href="${escapeHtml(url)}" target="_blank" rel="noopener"
         class="block w-full py-10 rounded-lg border-2 border-dashed border-slate-300 bg-white hover:border-teal-400 hover:bg-teal-50/40 transition text-center">
        <svg class="w-12 h-12 text-teal mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p class="text-sm font-bold text-slate-700">Open Certificate</p>
        <p class="text-xs text-slate-400 mt-1">Opens in a new tab</p>
      </a>
    `;
  }

  function renderStatusBanner(status) {
    const el = $('statusBanner');
    if (status === 'active') {
      el.innerHTML = `
        <div class="flex items-center gap-3 px-5 py-3 bg-teal-50 border border-teal-200 rounded-2xl">
          <svg class="w-5 h-5 text-teal flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
          </svg>
          <span class="text-sm font-bold text-teal-800">Verified · Active Certificate</span>
        </div>`;
    } else if (status === 'revoked') {
      el.innerHTML = `
        <div class="flex items-center gap-3 px-5 py-3 bg-red-50 border border-red-200 rounded-2xl">
          <svg class="w-5 h-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
          </svg>
          <span class="text-sm font-bold text-red-700">This certificate has been revoked</span>
        </div>`;
    } else if (status === 'pending') {
      el.innerHTML = `
        <div class="flex items-center gap-3 px-5 py-3 bg-yellow-50 border border-yellow-200 rounded-2xl">
          <span class="text-sm font-bold text-yellow-700">This certificate is pending review</span>
        </div>`;
    } else {
      el.innerHTML = `
        <div class="flex items-center gap-3 px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl">
          <span class="text-sm font-bold text-slate-700">Status: ${escapeHtml(status)}</span>
        </div>`;
    }
  }

  async function renderResult(cert) {
    showOnly('result');
    renderStatusBanner(cert.Status);
    $('certIdBadge').textContent = cert.CertID;
    $('metaId').textContent = cert.CertID;
    $('metaName').textContent = cert.StudentName || '—';
    $('metaCourse').textContent = cert.Course || '—';
    $('metaLevel').textContent = cert.Level || '—';
    $('metaDate').textContent = fmtDate(cert.IssueDate);
    $('metaIssuer').textContent = cert.Issuer || 'Lingo-Ville Language Centre';

    const reportCard = $('reportCard');
    if (cert.ReportURL) {
      reportCard.classList.remove('hidden');
      $('reportDownloadBtn').href = cert.ReportURL;
    } else {
      reportCard.classList.add('hidden');
    }

    const pdfViewer = $('pdfViewer');
    if (cert.Status === 'revoked') {
      pdfViewer.innerHTML = `
        <div class="text-center py-16 px-4">
          <p class="text-slate-500 font-semibold">The PDF preview has been disabled because this certificate is revoked.</p>
          <p class="text-xs text-slate-400 mt-2">If you believe this is an error, contact ${escapeHtml(CFG.SUPPORT_EMAIL)}.</p>
        </div>`;
    } else if (cert.CertURL) {
      pdfViewer.innerHTML = `
        <div class="text-center py-20">
          <div class="spinner mx-auto"></div>
          <p class="text-xs text-slate-400 mt-3">Rendering PDF…</p>
        </div>`;
      renderPdf(pdfViewer, cert.CertURL);
    } else {
      pdfViewer.innerHTML = `<div class="text-center py-16 text-slate-500 text-sm">Certificate file is not available.</div>`;
    }
  }

  function renderError(message, title) {
    showOnly('error');
    $('errorTitle').textContent = title || 'Certificate Not Found';
    $('errorMessage').textContent = message || 'The ID you entered does not match any record.';
  }

  let currentLookup = 0;

  async function handleRoute() {
    const certId = parseHash();
    if (!certId) { showOnly('search'); return; }

    const myLookup = ++currentLookup;
    const cached = readCertCache(certId);
    if (cached) {
      if (myLookup !== currentLookup) return;
      renderResult(cached);
      return;
    }

    showOnly('loading');
    try {
      const cert = await fetchCert(certId);
      if (myLookup !== currentLookup) return;
      writeCertCache(certId, cert);
      renderResult(cert);
    } catch (err) {
      if (myLookup !== currentLookup) return;
      if (err.message === 'CERT_NOT_FOUND') {
        renderError(`No certificate matches the ID "${certId}".`, 'Certificate Not Found');
      } else if (err.message === 'MISSING_CERT_ID') {
        showOnly('search');
      } else {
        renderError('Could not reach the verification service. Please try again.', 'Verification Error');
      }
    }
  }

  let prefetchTimer = null;
  const prefetchedIds = new Set();

  function prefetchCert(certId) {
    if (!certId) return;
    if (prefetchedIds.has(certId)) return;
    if (readCertCache(certId)) return;
    prefetchedIds.add(certId);
    fetchCert(certId).then(d => writeCertCache(certId, d)).catch(() => {});
  }

  function getShareUrl() { return window.location.href; }

  async function shareInstagramStory() {
    const url = getShareUrl();
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Lingo‑Ville Certificate', text: 'I just got certified by Lingo‑Ville 🎓', url });
        return;
      } catch (err) { if (err && err.name === 'AbortError') return; }
    }
    showToast('Open this page on your phone to post to Instagram Story');
  }

  function shareLinkedIn() {
    const url = encodeURIComponent(getShareUrl());
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank', 'noopener,width=620,height=620');
  }

  async function shareCopyLink() {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      showToast('Verification link copied');
    } catch (_) {
      window.prompt('Copy this link:', url);
    }
  }

  function wireShareButtons() {
    $('shareInstagramBtn')?.addEventListener('click', shareInstagramStory);
    $('shareLinkedinBtn')?.addEventListener('click', shareLinkedIn);
    $('shareLinkBtn')?.addEventListener('click', shareCopyLink);
  }

  // ===================================================================
  // QR SCANNER — ZXing (primary) + jsQR (fallback)
  // ===================================================================
  const qr = {
    modal: null, video: null, videoWrapper: null, closeBtn: null,
    status: null, statusText: null, retryBtn: null,
    stream: null,
    scanTimer: null,
    canvas: null, ctx: null,
    active: false,
    starting: false,
    frameCount: 0,
    lastScanMs: 0,
    lastRaw: '', lastRawCount: 0, lastRawTime: 0,
    handling: false,
    debugEl: null,

    zxingReader: null,
    zxingHints: null,
    zxingReady: false
  };

  function injectQrStyles() {
    if (document.getElementById('qr-extra-styles')) return;
    const s = document.createElement('style');
    s.id = 'qr-extra-styles';
    s.textContent = `
      .qr-video-wrapper.qr-detected::after {
        content: '';
        position: absolute;
        inset: 0;
        border: 6px solid #00ff88;
        pointer-events: none;
        z-index: 10;
        box-shadow: inset 0 0 60px rgba(0,255,136,0.5);
        animation: qrDetectedPulse 0.5s ease-out;
      }
      @keyframes qrDetectedPulse {
        0%   { opacity: 0; }
        40%  { opacity: 1; }
        100% { opacity: 0.85; }
      }
      .qr-detected-badge {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #00ff88;
        color: #0f172a;
        padding: 10px 22px;
        border-radius: 999px;
        font-weight: 800;
        font-size: 0.9rem;
        z-index: 11;
        box-shadow: 0 8px 24px rgba(0,255,136,0.5);
        white-space: nowrap;
        animation: qrBadgePop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      @keyframes qrBadgePop {
        0%   { transform: translateX(-50%) scale(0.5); opacity: 0; }
        100% { transform: translateX(-50%) scale(1);   opacity: 1; }
      }
      .qr-debug-overlay {
        position: absolute;
        top: 8px;
        left: 8px;
        background: rgba(0, 0, 0, 0.7);
        color: #00ff88;
        padding: 4px 8px;
        font-family: ui-monospace, SFMono-Regular, monospace;
        font-size: 10px;
        line-height: 1.4;
        border-radius: 4px;
        z-index: 20;
        pointer-events: none;
        white-space: pre;
      }
    `;
    document.head.appendChild(s);
  }

  function initZxing() {
    if (typeof window.ZXing === 'undefined') {
      console.warn('[QR] ZXing not loaded — will fall back to jsQR only');
      return;
    }
    try {
      const hints = new Map();
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.QR_CODE]);
      hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
      hints.set(ZXing.DecodeHintType.CHARACTER_SET, 'UTF-8');

      const reader = new ZXing.MultiFormatReader();
      reader.setHints(hints);

      qr.zxingReader = reader;
      qr.zxingHints = hints;
      qr.zxingReady = true;
      console.log('[QR] ZXing ready (TRY_HARDER enabled)');
    } catch (err) {
      console.warn('[QR] ZXing init failed:', err);
      qr.zxingReady = false;
    }
  }

  function decodeWithZxing(canvas) {
    if (!qr.zxingReady || !qr.zxingReader) return null;
    try {
      const source = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
      const bitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(source));
      const result = qr.zxingReader.decode(bitmap, qr.zxingHints);
      if (result && result.getText()) {
        return result.getText();
      }
    } catch (_) {}
    return null;
  }

  function initQrScanner() {
    qr.modal        = $('qrModal');
    qr.video        = $('qrVideo');
    qr.videoWrapper = $('qrVideoWrapper');
    qr.closeBtn     = $('qrCloseBtn');
    qr.status       = $('qrStatus');
    qr.statusText   = $('qrStatusText');
    qr.retryBtn     = $('qrRetryBtn');

    if (!qr.modal) { console.warn('[QR] modal not found'); return; }

    injectQrStyles();

    qr.canvas = document.createElement('canvas');
    qr.ctx = qr.canvas.getContext('2d', { willReadFrequently: true });

    qr.debugEl = document.createElement('div');
    qr.debugEl.className = 'qr-debug-overlay';
    qr.debugEl.textContent = 'initializing…';
    qr.videoWrapper.appendChild(qr.debugEl);

    $('scanQrBtn')?.addEventListener('click', openQrScanner);
    qr.closeBtn?.addEventListener('click', closeQrScanner);
    qr.retryBtn?.addEventListener('click', () => {
      qr.starting = false;
      if (qr.stream) {
        qr.stream.getTracks().forEach(t => t.stop());
        qr.stream = null;
      }
      startCamera();
    });

    qr.modal.addEventListener('click', (e) => {
      if (e.target === qr.modal) closeQrScanner();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && qr.active) closeQrScanner();
    });

    initZxing();
  }

  function setDebug(text) {
    if (qr.debugEl) qr.debugEl.textContent = text;
  }

  function setQrStatus(message, showRetry = false) {
    if (!qr.status) return;
    qr.status.classList.add('visible');
    qr.videoWrapper.style.display = 'none';
    if (qr.statusText) qr.statusText.textContent = message;
    if (qr.retryBtn) qr.retryBtn.style.display = showRetry ? 'inline-block' : 'none';
  }

  function clearQrStatus() {
    if (!qr.status) return;
    qr.status.classList.remove('visible');
    qr.videoWrapper.style.display = '';
  }

  async function openQrScanner() {
    if (!qr.modal) return;

    if (!window.isSecureContext) {
      showToast('Camera requires HTTPS');
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('Camera not supported in this browser');
      return;
    }

    if (!qr.zxingReady && typeof window.jsQR !== 'function') {
      await new Promise(r => setTimeout(r, 700));
      initZxing();
      if (!qr.zxingReady && typeof window.jsQR !== 'function') {
        showToast('QR library failed to load. Please refresh.');
        console.error('[QR] No decoder available');
        return;
      }
    }

    qr.active = true;
    qr.handling = false;
    qr.frameCount = 0;
    qr.lastScanMs = 0;
    qr.lastRaw = '';
    qr.lastRawCount = 0;
    qr.modal.classList.add('open');
    qr.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('qr-modal-open');
    clearQrStatus();
    qr.videoWrapper.classList.remove('qr-detected');
    qr.videoWrapper.querySelectorAll('.qr-detected-badge').forEach(el => el.remove());
    setDebug('starting camera…');

    await startCamera();
  }

  function closeQrScanner() {
    if (!qr.active) return;
    qr.active = false;
    qr.handling = false;
    stopScanLoop();
    stopCamera();
    qr.modal.classList.remove('open');
    qr.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('qr-modal-open');
    qr.videoWrapper.classList.remove('qr-detected');
    qr.videoWrapper.querySelectorAll('.qr-detected-badge').forEach(el => el.remove());
    clearQrStatus();
  }

  async function startCamera() {
    if (qr.starting) {
      console.log('[QR] startCamera: already in progress, skipping');
      return;
    }
    if (qr.stream) {
      console.log('[QR] startCamera: stream already active, skipping');
      return;
    }
    qr.starting = true;

    try {
      stopScanLoop();
      clearQrStatus();

      const attempts = [
        { audio: false, video: {
            facingMode: { ideal: 'environment' },
            width:  { ideal: 1920, min: 640 },
            height: { ideal: 1080, min: 480 }
        }},
        { audio: false, video: { facingMode: { ideal: 'environment' } } },
        { audio: false, video: { facingMode: 'environment' } },
        { audio: false, video: true }
      ];

      let lastErr = null;
      for (const constraints of attempts) {
        try {
          qr.stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (err) {
          lastErr = err;
          console.warn('[QR] Constraint failed:', JSON.stringify(constraints.video), err.name);
        }
      }

      if (!qr.stream) {
        let msg = 'Could not access the camera.';
        if (lastErr) {
          if (lastErr.name === 'NotAllowedError' || lastErr.name === 'SecurityError') {
            msg = 'Camera permission denied. Please allow camera access and try again.';
          } else if (lastErr.name === 'NotFoundError' || lastErr.name === 'DevicesNotFoundError') {
            msg = 'No camera found on this device.';
          } else if (lastErr.name === 'NotReadableError') {
            msg = 'Camera is in use by another app. Close it and retry.';
          }
        }
        setQrStatus(msg, true);
        return;
      }

      const track = qr.stream.getVideoTracks()[0];
      console.log('[QR] Stream acquired:', track?.getSettings?.());

      qr.video.srcObject = qr.stream;
      qr.video.setAttribute('playsinline', 'true');
      qr.video.setAttribute('webkit-playsinline', 'true');
      qr.video.muted = true;
      qr.video.playsInline = true;

      try { await qr.video.play(); } catch (err) { console.warn('[QR] play() failed:', err); }

      await waitForVideoReady();

      console.log('[QR] Video ready: ' + qr.video.videoWidth + 'x' + qr.video.videoHeight);
      setDebug('scanning…');

      startScanLoop();
    } finally {
      qr.starting = false;
    }
  }

  function waitForVideoReady() {
    return new Promise((resolve) => {
      if (qr.video.videoWidth > 0 && qr.video.readyState >= 2) return resolve();
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      qr.video.addEventListener('loadeddata', finish, { once: true });
      qr.video.addEventListener('playing', finish, { once: true });
      const poll = setInterval(() => {
        if (qr.video.videoWidth > 0 && qr.video.readyState >= 2) {
          clearInterval(poll); finish();
        }
      }, 80);
      setTimeout(() => { clearInterval(poll); finish(); }, 3000);
    });
  }

  function stopCamera() {
    if (qr.stream) {
      qr.stream.getTracks().forEach(t => t.stop());
      qr.stream = null;
    }
    if (qr.video) {
      try { qr.video.pause(); } catch (_) {}
      qr.video.srcObject = null;
    }
    qr.starting = false;
  }

  function startScanLoop() {
    stopScanLoop();
    const INTERVAL = 120;

    const tick = () => {
      if (!qr.active || qr.handling) return;
      try { scanOnce(); } catch (err) { console.warn('[QR] scan error:', err); }
      qr.scanTimer = setTimeout(tick, INTERVAL);
    };

    qr.scanTimer = setTimeout(tick, 150);
  }

  function stopScanLoop() {
    if (qr.scanTimer) { clearTimeout(qr.scanTimer); qr.scanTimer = null; }
  }

  function scanOnce() {
    const video = qr.video;
    if (!video || video.readyState < 2 || !video.videoWidth) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    const maxDim = 900;
    const scale = Math.min(1, maxDim / Math.max(vw, vh));
    const w = Math.max(1, Math.round(vw * scale));
    const h = Math.max(1, Math.round(vh * scale));

    if (qr.canvas.width !== w || qr.canvas.height !== h) {
      qr.canvas.width = w;
      qr.canvas.height = h;
    }

    try {
      qr.ctx.drawImage(video, 0, 0, w, h);
    } catch (err) {
      qr.frameCount++;
      return;
    }

    const t0 = performance.now();
    const zxingResult = decodeWithZxing(qr.canvas);
    const zxingMs = Math.round(performance.now() - t0);
    qr.lastScanMs = zxingMs;

    if (zxingResult) {
      setDebug('ZXing HIT ✓');
      onDetected(zxingResult, 'zxing');
      return;
    }

    let jsqrMs = 0;
    if (typeof window.jsQR === 'function') {
      let imageData;
      try {
        imageData = qr.ctx.getImageData(0, 0, w, h);
      } catch (_) {
        qr.frameCount++;
        return;
      }
      const t1 = performance.now();
      let code = null;
      try {
        code = window.jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' });
      } catch (_) {}
      jsqrMs = Math.round(performance.now() - t1);

      if (code && code.data) {
        onDetected(code.data, 'jsqr');
        return;
      }
    }

    if (qr.frameCount % 3 === 0) {
      setDebug(
        'frames: ' + qr.frameCount +
        '\nZXing: ' + zxingMs + 'ms' +
        (jsqrMs ? '\njsQR: ' + jsqrMs + 'ms' : '') +
        '\nsize: ' + w + 'x' + h
      );
    }

    if (qr.frameCount % 30 === 0) {
      console.log('[QR] scan #' + qr.frameCount + ' · ' + w + 'x' + h +
        ' · ZXing ' + zxingMs + 'ms · jsQR ' + (jsqrMs || '-') + 'ms · no hit');
    }

    qr.frameCount++;
  }

  function onDetected(rawData, source) {
    if (qr.handling) return;

    const now = Date.now();

    if (rawData === qr.lastRaw && now - qr.lastRawTime < 1500) {
      qr.lastRawCount++;
    } else {
      qr.lastRaw = rawData;
      qr.lastRawCount = 1;
      qr.lastRawTime = now;
    }

    if (qr.lastRawCount < 2) {
      setDebug('sighting 1/2 · ' + rawData.slice(0, 20));
      return;
    }

    qr.handling = true;
    setDebug('detected ✓');

    console.log('[QR] ✅ Confirmed (' + source + '):', JSON.stringify(rawData));

    const certId = extractCertId(rawData);
    console.log('[QR] → extracted cert ID:', JSON.stringify(certId));

    if (!certId) {
      console.warn('[QR] ❌ Empty cert ID after extraction');
      showToast('Could not read the QR code. Try again.');
      setTimeout(() => {
        qr.handling = false;
        qr.lastRawCount = 0;
        qr.lastRaw = '';
        setDebug('scanning…');
      }, 1200);
      return;
    }

    if (navigator.vibrate) {
      try { navigator.vibrate([60, 40, 100]); } catch (_) {}
    }

    showDetectedOnVideo();
    try { qr.video.pause(); } catch (_) {}

    const input = $('certInput');
    if (input) input.value = certId;

    setTimeout(() => {
      try { closeQrScanner(); } catch (e) { console.warn('[QR] close error:', e); }

      const next = `#/${encodeURIComponent(certId)}`;
      console.log('[QR] → routing to "' + next + '"');
      if (window.location.hash !== next) {
        window.location.hash = next;
      } else {
        handleRoute();
      }

      qr.handling = false;
      qr.lastRaw = '';
      qr.lastRawCount = 0;
    }, 550);
  }

  function showDetectedOnVideo() {
    if (!qr.videoWrapper) return;
    qr.videoWrapper.classList.add('qr-detected');
    const badge = document.createElement('div');
    badge.className = 'qr-detected-badge';
    badge.textContent = '✓ QR detected';
    qr.videoWrapper.appendChild(badge);
  }

  // ===================================================================
  // extractCertId — MAXIMALLY PERMISSIVE
  // ===================================================================
  //
  // Handles:
  //   https://cert.lingo-ville.com/#/encom-26abk-b1
  //   cert.lingo-ville.com/#/encom-26abk-b1          ← no protocol
  //   cert.lingo-ville.com/#encom-26abk-b1           ← no protocol, no slash
  //   cert.lingo-ville.com/?id=encom-26abk-b1        ← no protocol
  //   cert.lingo-ville.com/c/encom-26abk-b1
  //   ENCOM-26ABK-B1
  //   Certificate ID: ENCOM-26ABK-B1
  //
  function extractCertId(content) {
    if (content == null) return '';
    let s = String(content).trim();

    // Strip surrounding quotes
    if ((s.startsWith('"') && s.endsWith('"')) ||
        (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1).trim();
    }

    // Strip "Certificate ID:" style prefixes
    s = s.replace(/^(certificate\s*(id)?|cert\s*id|cert)\s*[:\-–]\s*/i, '').trim();

    if (!s) return '';

    // --- Normalize into a URL if it looks like one ---
    let urlString = s;
    const hasProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(urlString);

    if (!hasProtocol) {
      // Signs it's a URL without a protocol:
      //   host.tld followed by /, #, ?, :, or end
      //   no whitespace
      const looksLikeUrl =
        /^[\w-]+(\.[\w-]+)+(\.[a-z]{2,})?(\/|#|\?|:|$)/i.test(urlString) &&
        !/\s/.test(urlString);

      if (looksLikeUrl) {
        urlString = 'https://' + urlString;
      }
    }

    // --- Try parsing as URL ---
    if (/^https?:\/\//i.test(urlString)) {
      let url = null;
      try { url = new URL(urlString); } catch (_) {}

      if (url) {
        // 1) Hash fragment
        if (url.hash) {
          const rawHash = url.hash.replace(/^#!?\/?/, '').trim();
          if (rawHash) {
            const head = rawHash.split(/[?&#]/)[0];
            const decoded = safeDecode(head).replace(/\/+$/, '').trim();
            if (decoded) return decoded.toLowerCase();
          }
        }

        // 2) Query params
        const preferred = ['id', 'cert', 'certid', 'certificate', 'certificateid', 'code'];
        for (const key of preferred) {
          const v = url.searchParams.get(key);
          if (v && v.trim()) return v.trim().toLowerCase();
        }
        for (const [, v] of url.searchParams.entries()) {
          if (v && v.trim()) return v.trim().toLowerCase();
        }

        // 3) Last path segment
        const skip = new Set(['verify', 'cert', 'certificate', 'certificates', 'index', 'index.html', 'home', '']);
        const parts = url.pathname.split('/').filter(Boolean);
        for (let i = parts.length - 1; i >= 0; i--) {
          const seg = parts[i].replace(/\.[a-z0-9]+$/i, '').trim();
          if (!seg) continue;
          if (skip.has(seg.toLowerCase())) continue;
          return safeDecode(seg).toLowerCase();
        }
      }
    }

    // --- Plain text — longest line ---
    const lines = s.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
    if (lines.length) {
      return lines.sort((a, b) => b.length - a.length)[0].toLowerCase();
    }

    return s.toLowerCase();
  }

  function safeDecode(v) {
    try { return decodeURIComponent(v); } catch (_) { return v; }
  }

  $('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = $('certInput').value.trim().toLowerCase();
    if (!val) return;
    setHash(val);
  });

  $('certInput').addEventListener('input', (e) => {
    clearTimeout(prefetchTimer);
    const val = e.target.value.trim().toLowerCase();
    if (val.length < 3) return;
    prefetchTimer = setTimeout(() => prefetchCert(val), 400);
  });

  $('backBtn').addEventListener('click', () => {
    $('certInput').value = '';
    clearHash();
    showOnly('search');
    setTimeout(() => $('certInput').focus(), 50);
  });

  $('errorBackBtn').addEventListener('click', () => {
    $('certInput').value = '';
    clearHash();
    showOnly('search');
    setTimeout(() => $('certInput').focus(), 50);
  });

  window.addEventListener('hashchange', handleRoute);
  window.addEventListener('popstate', handleRoute);

  // ---------- Boot ----------
  $('year').textContent = new Date().getFullYear();
  const initial = parseHash();
  if (initial) $('certInput').value = initial;

  wireShareButtons();
  initQrScanner();
  handleRoute();
})();