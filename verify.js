/* Lingo‑Ville — public certificate verification */
(function () {
  const CFG = window.VERIFY_CONFIG;

  // ---------- Setup PDF.js ----------
  if (window.pdfjsLib && CFG.PDFJS_WORKER) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = CFG.PDFJS_WORKER;
  }

  // ---------- DOM ----------
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

  // ---------- Helpers ----------
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

  // ---------- Local cache ----------
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

  // ---------- Hash routing ----------
  function parseHash() {
    const raw = (window.location.hash || '').replace(/^#\/?/, '').trim();
    return raw ? decodeURIComponent(raw).toLowerCase() : '';
  }

  function setHash(certId) {
    const next = `#/${encodeURIComponent(certId)}`;
    if (window.location.hash !== next) {
      window.history.pushState(null, '', next);
      handleRoute();
    }
  }

  function clearHash() {
    if (window.location.hash) {
      window.history.pushState(null, '', window.location.pathname);
    }
  }

  // ---------- API ----------
  async function fetchCert(certId) {
    const url = `${CFG.APPS_SCRIPT_URL}?action=getCert&id=${encodeURIComponent(certId)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('NETWORK_' + res.status);
    const json = await res.json();
    if (json.status !== 'success') throw new Error(json.message || 'LOOKUP_FAILED');
    return json.data;
  }

  // ---------- PDF rendering ----------
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

  // ---------- Render states ----------
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

  // ---------- Router ----------
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

  // ---------- Prefetch on typing ----------
  let prefetchTimer = null;
  const prefetchedIds = new Set();

  function prefetchCert(certId) {
    if (!certId) return;
    if (prefetchedIds.has(certId)) return;
    if (readCertCache(certId)) return;
    prefetchedIds.add(certId);
    fetchCert(certId).then(d => writeCertCache(certId, d)).catch(() => {});
  }

  // ---------- Sharing ----------
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
  // QR SCANNER
  // ===================================================================
  const qr = {
    modal: null, video: null, videoWrapper: null, closeBtn: null,
    status: null, statusText: null, retryBtn: null,
    stream: null, scanTimer: null,
    canvas: null, ctx: null,
    active: false,
    cameraStarting: false,
    detector: null,
    scanMode: 'none',
    lastScan: '', lastScanTime: 0,
    frameCount: 0,
    frozen: false,
    freezeCanvas: null,
    freezeBadge: null
  };

  // One-time animation + styles for the freeze overlay
  function injectFreezeStyles() {
    if (document.getElementById('qr-freeze-styles')) return;
    const s = document.createElement('style');
    s.id = 'qr-freeze-styles';
    s.textContent = `
      @keyframes qrPop {
        0%   { transform: translateX(-50%) scale(0.5); opacity: 0; }
        60%  { transform: translateX(-50%) scale(1.1); opacity: 1; }
        100% { transform: translateX(-50%) scale(1);   opacity: 1; }
      }
      @keyframes qrFlash {
        0%   { opacity: 0; }
        30%  { opacity: 1; }
        100% { opacity: 0; }
      }
      .qr-freeze-flash {
        position: absolute; inset: 0; background: #00ff88;
        pointer-events: none; z-index: 7;
        animation: qrFlash 0.5s ease-out forwards;
      }
    `;
    document.head.appendChild(s);
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

    injectFreezeStyles();

    qr.canvas = document.createElement('canvas');
    qr.ctx = qr.canvas.getContext('2d', { willReadFrequently: true });

    $('scanQrBtn')?.addEventListener('click', openQrScanner);
    qr.closeBtn?.addEventListener('click', closeQrScanner);
    qr.retryBtn?.addEventListener('click', startCamera);

    qr.modal.addEventListener('click', (e) => {
      if (e.target === qr.modal) closeQrScanner();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && qr.active) closeQrScanner();
    });

    setupDetector();
  }

  async function setupDetector() {
    if ('BarcodeDetector' in window) {
      try {
        if (typeof window.BarcodeDetector.getSupportedFormats === 'function') {
          const formats = await window.BarcodeDetector.getSupportedFormats();
          if (formats.includes('qr_code')) {
            qr.detector = new window.BarcodeDetector({ formats: ['qr_code'] });
            console.log('[QR] Native BarcodeDetector ready');
          }
        } else {
          qr.detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          console.log('[QR] Native BarcodeDetector ready (no format probe)');
        }
      } catch (err) {
        console.warn('[QR] BarcodeDetector init failed:', err);
      }
    }

    if (typeof window.jsQR === 'function') {
      console.log('[QR] jsQR library loaded');
    } else {
      console.warn('[QR] jsQR library NOT loaded');
    }

    if (qr.detector && typeof window.jsQR === 'function') qr.scanMode = 'both';
    else if (qr.detector) qr.scanMode = 'native';
    else if (typeof window.jsQR === 'function') qr.scanMode = 'jsqr';
    else qr.scanMode = 'none';

    console.log('[QR] Scan strategy:', qr.scanMode);
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

    if (qr.scanMode === 'none' || !qr.detector) {
      await setupDetector();
    }

    if (qr.scanMode === 'none') {
      await new Promise(r => setTimeout(r, 600));
      await setupDetector();
      if (qr.scanMode === 'none') {
        showToast('QR library failed to load. Please refresh.');
        return;
      }
    }

    qr.active = true;
    qr.frozen = false;
    qr.frameCount = 0;
    qr.modal.classList.add('open');
    qr.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('qr-modal-open');
    clearQrStatus();
    await startCamera();
  }

  function closeQrScanner() {
    if (!qr.active) return;
    qr.active = false;
    qr.frozen = false;
    unfreezeFrame();
    stopCamera();
    qr.modal.classList.remove('open');
    qr.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('qr-modal-open');
    clearQrStatus();
  }

  async function startCamera() {
    if (qr.cameraStarting) return;
    qr.cameraStarting = true;

    try {
      stopCamera();
      clearQrStatus();
      unfreezeFrame();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setQrStatus('Camera is not supported in this browser.', false);
        return;
      }

      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      try {
        qr.stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.warn('[QR] getUserMedia error:', err && err.name);
        if (err && err.name === 'OverconstrainedError') {
          try {
            qr.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
          } catch (err2) {
            setQrStatus('Could not access the camera.', false);
            return;
          }
        } else {
          let msg = 'Could not access the camera.';
          if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
            msg = 'Camera permission denied. Please allow camera access and try again.';
          } else if (err && (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError')) {
            msg = 'No camera found on this device.';
          } else if (err && err.name === 'NotReadableError') {
            msg = 'Camera is in use by another app. Close it and retry.';
          }
          setQrStatus(msg, true);
          return;
        }
      }

      console.log('[QR] Stream acquired:', qr.stream.getVideoTracks()[0]?.getSettings?.());

      qr.video.srcObject = qr.stream;
      qr.video.setAttribute('playsinline', 'true');
      qr.video.setAttribute('webkit-playsinline', 'true');
      qr.video.muted = true;
      qr.video.playsInline = true;

      try {
        await qr.video.play();
      } catch (err) {
        console.warn('[QR] video.play() failed:', err);
      }

      await waitForVideoReady();
      startScanLoop();
    } finally {
      qr.cameraStarting = false;
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
      }, 100);
      setTimeout(() => { clearInterval(poll); finish(); }, 3000);
    });
  }

  function stopCamera() {
    stopScanLoop();
    if (qr.stream) {
      qr.stream.getTracks().forEach(t => t.stop());
      qr.stream = null;
    }
    if (qr.video) qr.video.srcObject = null;
  }

  function startScanLoop() {
    stopScanLoop();
    if (qr.frozen) return;

    const SCAN_INTERVAL_MS = 100; // 10 fps

    const tick = () => {
      if (!qr.active || qr.frozen) return;
      try { scanOnce(); } catch (err) { console.warn('[QR] scanOnce error:', err); }
      qr.scanTimer = setTimeout(tick, SCAN_INTERVAL_MS);
    };

    qr.scanTimer = setTimeout(tick, 200);
  }

  function stopScanLoop() {
    if (qr.scanTimer) { clearTimeout(qr.scanTimer); qr.scanTimer = null; }
  }

  function scanOnce() {
    const video = qr.video;
    if (!video || video.readyState < 2 || !video.videoWidth) {
      qr.frameCount++;
      return;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(vw, vh));
    const w = Math.max(1, Math.round(vw * scale));
    const h = Math.max(1, Math.round(vh * scale));

    if (qr.canvas.width !== w || qr.canvas.height !== h) {
      qr.canvas.width = w;
      qr.canvas.height = h;
    }

    try { qr.ctx.drawImage(video, 0, 0, w, h); }
    catch (err) { return; }

    let imageData;
    try { imageData = qr.ctx.getImageData(0, 0, w, h); }
    catch (err) { return; }

    qr.frameCount++;

    // --- Native detector ---
    if (qr.detector) {
      qr.detector.detect(qr.canvas)
        .then(codes => {
          if (!qr.active || qr.frozen) return;
          if (codes && codes.length && codes[0].rawValue) {
            const loc = codes[0].cornerPoints
              ? { cornerPoints: codes[0].cornerPoints }
              : null;
            onQrDetected(codes[0].rawValue, loc);
          }
        })
        .catch(() => {});
    }

    // --- jsQR ---
    if (typeof window.jsQR === 'function' && !qr.frozen) {
      let code = null;
      try {
        code = window.jsQR(imageData.data, w, h, { inversionAttempts: 'attemptBoth' });
      } catch (err) {}

      if (code && code.data) {
        onQrDetected(code.data, code.location);
        return;
      }
    }

    if (qr.frameCount % 40 === 0) {
      console.log('[QR] Frame #' + qr.frameCount + ' · ' + w + 'x' + h + ' · scanning…');
    }
  }

  // ===================================================================
  // FREEZE ON DETECTION
  // ===================================================================

  /**
   * Called the instant a QR is decoded.
   * Freezes the visible frame, draws the captured image with the QR
   * outlined, shows a checkmark, then proceeds.
   */
  function onQrDetected(rawData, location) {
    if (qr.frozen) return; // already handling a detection
    qr.frozen = true;
    stopScanLoop();

    console.log('[QR] ✅ Detected:', rawData);

    const certId = extractCertId(rawData);

    // Freeze the frame on-screen with the box + badge
    freezeFrame(location, certId ? 'ok' : 'bad');

    if (!certId) {
      // Not a Lingo-Ville QR — show the message, then resume scanning
      showToast('This QR code is not a Lingo‑Ville certificate');
      setTimeout(() => {
        if (!qr.active) return;
        unfreezeFrame();
        qr.frozen = false;
        startScanLoop();
      }, 1400);
      return;
    }

    console.log('[QR] ✅ Cert ID:', certId);

    if (navigator.vibrate) { try { navigator.vibrate([40, 30, 80]); } catch (_) {} }

    // Show the frozen frame for a beat so the user SEES the detection,
    // then close the modal and start verification.
    setTimeout(() => {
      closeQrScanner();
      const input = $('certInput');
      if (input) input.value = certId;
      setTimeout(() => setHash(certId), 60);
    }, 900);
  }

  function freezeFrame(location, mode) {
    const video = qr.video;
    const wrapper = qr.videoWrapper;

    // Pause the video so the visible preview stops moving
    try { video.pause(); } catch (_) {}

    // Create freeze canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'qr-freeze-canvas';
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      zIndex: '5',
      display: 'block'
    });

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const okColor = '#00ff88';
    const badColor = '#ff5b5b';
    const color = mode === 'ok' ? okColor : badColor;

    // Draw the QR outline
    const corners = getCorners(location, canvas.width, canvas.height);
    if (corners) {
      const pad = Math.max(8, canvas.width * 0.012);

      // Dim everything outside the box
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      // cut-out (counter-clockwise)
      ctx.moveTo(corners.tl.x, corners.tl.y);
      ctx.lineTo(corners.bl.x, corners.bl.y);
      ctx.lineTo(corners.br.x, corners.br.y);
      ctx.lineTo(corners.tr.x, corners.tr.y);
      ctx.closePath();
      ctx.fill('evenodd');
      ctx.restore();

      // Thick outline
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(4, canvas.width * 0.007);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(corners.tl.x, corners.tl.y);
      ctx.lineTo(corners.tr.x, corners.tr.y);
      ctx.lineTo(corners.br.x, corners.br.y);
      ctx.lineTo(corners.bl.x, corners.bl.y);
      ctx.closePath();
      ctx.stroke();

      // Corner ticks
      const tickLen = Math.max(20, canvas.width * 0.03);
      ctx.lineWidth = Math.max(6, canvas.width * 0.011);
      ctx.beginPath();
      // TL
      ctx.moveTo(corners.tl.x, corners.tl.y + tickLen);
      ctx.lineTo(corners.tl.x, corners.tl.y);
      ctx.lineTo(corners.tl.x + tickLen, corners.tl.y);
      // TR
      ctx.moveTo(corners.tr.x - tickLen, corners.tr.y);
      ctx.lineTo(corners.tr.x, corners.tr.y);
      ctx.lineTo(corners.tr.x, corners.tr.y + tickLen);
      // BR
      ctx.moveTo(corners.br.x, corners.br.y - tickLen);
      ctx.lineTo(corners.br.x, corners.br.y);
      ctx.lineTo(corners.br.x - tickLen, corners.br.y);
      // BL
      ctx.moveTo(corners.bl.x + tickLen, corners.bl.y);
      ctx.lineTo(corners.bl.x, corners.bl.y);
      ctx.lineTo(corners.bl.x, corners.bl.y - tickLen);
      ctx.stroke();
      ctx.restore();
    }

    wrapper.appendChild(canvas);
    qr.freezeCanvas = canvas;

    // Green flash
    const flash = document.createElement('div');
    flash.className = 'qr-freeze-flash';
    if (mode === 'bad') flash.style.background = badColor;
    wrapper.appendChild(flash);
    setTimeout(() => flash.remove(), 600);

    // Badge
    const badge = document.createElement('div');
    badge.className = 'qr-freeze-badge';
    Object.assign(badge.style, {
      position: 'absolute',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: mode === 'ok' ? okColor : badColor,
      color: '#0f172a',
      padding: '10px 22px',
      borderRadius: '999px',
      fontWeight: '800',
      fontSize: '0.9rem',
      zIndex: '8',
      boxShadow: '0 8px 24px ' + (mode === 'ok' ? 'rgba(0,255,136,0.45)' : 'rgba(255,91,91,0.45)'),
      animation: 'qrPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
      whiteSpace: 'nowrap'
    });
    badge.textContent = mode === 'ok'
      ? '✓ QR detected — reading…'
      : '✕ Not a Lingo‑Ville QR';
    wrapper.appendChild(badge);
    qr.freezeBadge = badge;
  }

  function unfreezeFrame() {
    if (qr.freezeCanvas) { qr.freezeCanvas.remove(); qr.freezeCanvas = null; }
    if (qr.freezeBadge)  { qr.freezeBadge.remove();  qr.freezeBadge = null; }
    // Remove any stray flash elements
    qr.videoWrapper?.querySelectorAll('.qr-freeze-flash').forEach(el => el.remove());
    // Resume the video for the next scan round
    try { if (qr.video && qr.stream) qr.video.play().catch(() => {}); } catch (_) {}
  }

  /**
   * Normalizes corner points from either jsQR (location object)
   * or native BarcodeDetector (cornerPoints array).
   */
  function getCorners(location, w, h) {
    if (!location) return null;

    // jsQR — has topLeftCorner etc.
    if (location.topLeftCorner && location.topRightCorner &&
        location.bottomRightCorner && location.bottomLeftCorner) {
      return {
        tl: location.topLeftCorner,
        tr: location.topRightCorner,
        br: location.bottomRightCorner,
        bl: location.bottomLeftCorner
      };
    }

    // Native BarcodeDetector — cornerPoints array (TL, TR, BR, BL)
    if (location.cornerPoints && location.cornerPoints.length >= 4) {
      const [a, b, c, d] = location.cornerPoints;
      return { tl: a, tr: b, br: c, bl: d };
    }

    // Fallback — draw a centered box
    const size = Math.min(w, h) * 0.55;
    const x = (w - size) / 2;
    const y = (h - size) / 2;
    return {
      tl: { x, y },
      tr: { x: x + size, y },
      br: { x: x + size, y: y + size },
      bl: { x, y: y + size }
    };
  }

  function extractCertId(content) {
    if (!content) return '';
    const s = String(content).trim();

    if (/^https?:\/\//i.test(s)) {
      try {
        const url = new URL(s);
        const hash = (url.hash || '').replace(/^#\/?/, '').trim();
        if (hash) {
          const decoded = decodeURIComponent(hash).toLowerCase();
          if (/^[a-z0-9]+(?:-[a-z0-9]+){1,5}$/.test(decoded)) return decoded;
        }
        for (const p of ['id', 'cert', 'certid', 'certificate']) {
          const v = url.searchParams.get(p);
          if (v && /^[a-z0-9]+(?:-[a-z0-9]+){1,5}$/i.test(v.trim())) {
            return v.trim().toLowerCase();
          }
        }
        const parts = url.pathname.split('/').filter(Boolean);
        if (parts.length) {
          const last = parts[parts.length - 1].replace(/\.[a-z0-9]+$/i, '').trim();
          if (/^[a-z0-9]+(?:-[a-z0-9]+){1,5}$/i.test(last)) return last.toLowerCase();
        }
      } catch (_) {}
      return '';
    }

    const plain = s.toLowerCase();
    if (/^[a-z0-9]+(?:-[a-z0-9]+){1,5}$/.test(plain)) return plain;
    return '';
  }

  // ---------- Events ----------
  $('searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const val = $('certInput').value.trim().toLowerCase();
    if (!val) return;
    setHash(val);
  });

  $('certInput').addEventListener('input', (e) => {
    clearTimeout(prefetchTimer);
    const val = e.target.value.trim().toLowerCase();
    if (!/^[a-z0-9]+(-[a-z0-9]+){2,4}$/.test(val)) return;
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