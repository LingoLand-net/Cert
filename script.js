(function () {
    const CERTS_PATH = '/certs/';

    // DOM elements
    const landingState = document.getElementById('landingState');
    const certificateState = document.getElementById('certificateState');
    const errorState = document.getElementById('errorState');
    const toast = document.getElementById('toast');
    const certIdDisplay = document.getElementById('certIdDisplay');
    const certPdfLabel = document.getElementById('certPdfLabel');
    const reportPdfLabel = document.getElementById('reportPdfLabel');
    const certDownloadBtn = document.getElementById('certDownloadBtn');
    const reportDownloadBtn = document.getElementById('reportDownloadBtn');
    const certPdfContainer = document.getElementById('certPdfContainer');
    const pdfLoading = document.getElementById('pdfLoading');
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    const backBtn = document.getElementById('backBtn');
    const errorBackBtn = document.getElementById('errorBackBtn');
    const searchBtn = document.getElementById('searchBtn');
    const certIdInput = document.getElementById('certIdInput');
    const errorMessageEl = document.getElementById('errorMessage');

    const pdfCourseName = document.getElementById('pdfCourseName');
    const pdfLevel = document.getElementById('pdfLevel');
    const pdfIssueDate = document.getElementById('pdfIssueDate');
    const pdfIssuer = document.getElementById('pdfIssuer');

    const inlineLoader = document.getElementById('inlineOcrLoader');

    function showInlineLoader() {
        if (inlineLoader) inlineLoader.classList.remove('hidden');
        const certGrid = certificateState?.querySelector('.grid');
        if (certGrid) certGrid.style.display = 'none';
    }

    function hideInlineLoader() {
        if (inlineLoader) inlineLoader.classList.add('hidden');
        const certGrid = certificateState?.querySelector('.grid');
        if (certGrid) certGrid.style.display = '';
    }

    function getCertIdFromURL() {
        const hash = window.location.hash.replace(/^#\/?/, '');
        if (hash && hash !== 'index.html' && hash !== '') return hash.toLowerCase();
        return null;
    }

    function showState(state) {
        landingState.classList.add('hidden');
        certificateState.classList.add('hidden');
        errorState.classList.add('hidden');
        if (state === 'landing') {
            landingState.classList.remove('hidden');
            document.title = 'Certificate Verification — Lingo-Ville';
            if (window.location.hash) window.history.replaceState({}, '', window.location.pathname);
        } else if (state === 'certificate') {
            certificateState.classList.remove('hidden');
            const certGrid = certificateState?.querySelector('.grid');
            if (certGrid) certGrid.style.display = '';
            hideInlineLoader();
        } else if (state === 'error') {
            errorState.classList.remove('hidden');
            document.title = 'Certificate Not Found — Lingo-Ville';
        }
    }

    function showToast(msg, dur = 2000) {
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => toast.classList.remove('show'), dur);
    }

    function copyVerificationLink() {
        navigator.clipboard.writeText(window.location.href)
            .then(() => showToast('✅ Link copied!'))
            .catch(() => showToast('⚠️ Copy manually'));
    }

    async function loadTesseract() {
        if (window.Tesseract) return window.Tesseract;
        showToast('Loading OCR engine...', 3000);
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        return window.Tesseract;
    }

    async function pdfPageToCanvas(pdfUrl) {
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport }).promise;
        return canvas;
    }

    async function extractWithOCR(pdfUrl) {
        const Tesseract = await loadTesseract();
        showToast('Reading certificate...', 2000);
        showInlineLoader();
        try {
            const canvas = await pdfPageToCanvas(pdfUrl);
            const { data: { text } } = await Tesseract.recognize(canvas, 'eng', {
                logger: m => console.log(m)
            });
            console.log('OCR extracted text:', text);
            const cleaned = text.replace(/BL\+/gi, 'B1+').replace(/BL/gi, 'B1');
            return parseMetadataFromText(cleaned);
        } finally {
            hideInlineLoader();
        }
    }

    function parseMetadataFromText(fullText) {
        let issueDate = '—';
        let dateMatch = fullText.match(/Awarded\s+on\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
        if (!dateMatch) dateMatch = fullText.match(/([A-Za-z]+\s+\d{1,2},?\s+\d{4})/);
        if (dateMatch) issueDate = dateMatch[1].replace(/,(\S)/, ', $1');

        let course = '—';
        let courseMatch = fullText.match(/completed\s+the\s+([A-Za-z\s&]+?)\s+course/i);
        if (courseMatch) course = courseMatch[1].trim();

        let level = '—';
        let levelMatch = fullText.match(/level\s+([A-Za-z0-9\/\+]+)/i);
        if (!levelMatch) levelMatch = fullText.match(/\b([ABC][12](?:\+|\/[ABC][12])?)\b/i);
        if (levelMatch) {
            let rawLevel = levelMatch[1].toUpperCase();
            rawLevel = rawLevel.replace(/BL\+/g, 'B1+').replace(/BL/g, 'B1');
            level = rawLevel;
        }

        let issuer = 'Lingo‑Ville Language Centre';
        let issuerMatch = fullText.match(/(Mr|Ms|Mrs)\.\s+([A-Za-z\s]+?)(?=\s+English|\s+Teacher|\s+Director|$)/i);
        if (issuerMatch) issuer = `${issuerMatch[1]}. ${issuerMatch[2].trim()}`;

        return { issueDate, course, level, issuer };
    }

    async function extractPdfText(pdfUrl) {
        try {
            const loadingTask = pdfjsLib.getDocument(pdfUrl);
            const pdf = await loadingTask.promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent({ normalizeWhitespace: true });
                fullText += textContent.items.map(item => item.str).join(' ');
            }
            return fullText.trim();
        } catch (err) {
            console.warn('PDF text extraction error:', err);
            return '';
        }
    }

    async function extractPdfMetadata(pdfUrl, forceOCR = false) {
        let fullText = '';
        if (!forceOCR) {
            fullText = await extractPdfText(pdfUrl);
            console.log('PDF text length:', fullText.length);
        }
        if (fullText.length === 0 || forceOCR) {
            console.log('No selectable text – falling back to OCR.');
            return await extractWithOCR(pdfUrl);
        }
        return parseMetadataFromText(fullText);
    }

    async function pdfExists(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok;
        } catch {
            return false;
        }
    }

    // ========== SIMPLE, RELIABLE CANVAS RENDERER ==========
    async function renderPdfToCanvas(pdfUrl, container) {
        // Clear container
        while (container.firstChild) container.removeChild(container.firstChild);

        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.style.width = '100%';
        wrapper.style.height = '100%';
        wrapper.style.overflow = 'auto';
        wrapper.style.backgroundColor = '#e2e8f0';
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.alignItems = 'center';
        wrapper.style.padding = '1rem';
        wrapper.style.boxSizing = 'border-box';
        container.appendChild(wrapper);

        // Load PDF
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            
            // Get container width after wrapper is in DOM
            const containerWidth = wrapper.clientWidth - 32; // padding
            // Calculate scale to fit width (max scale 1.5 to avoid huge memory)
            const scale = Math.min(containerWidth / page.getViewport({ scale: 1 }).width, 1.5);
            const viewport = page.getViewport({ scale: scale });
            
            const canvas = document.createElement('canvas');
            canvas.style.display = 'block';
            canvas.style.width = '100%';
            canvas.style.height = 'auto';
            canvas.style.marginBottom = '1rem';
            canvas.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            const context = canvas.getContext('2d');
            await page.render({ canvasContext: context, viewport }).promise;
            wrapper.appendChild(canvas);
        }
    }

    async function loadPdfPreview(pdfUrl, container, loadingEl) {
        if (loadingEl) loadingEl.style.display = 'flex';
        try {
            await renderPdfToCanvas(pdfUrl, container);
            console.log('PDF rendered successfully');
        } catch (err) {
            console.error('Canvas render failed:', err);
            // Fallback to iframe
            showIframeFallback(container, pdfUrl);
        } finally {
            if (loadingEl) loadingEl.style.display = 'none';
        }
    }

    function showIframeFallback(container, pdfUrl) {
        const iframe = document.createElement('iframe');
        iframe.src = pdfUrl;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        container.appendChild(iframe);
        showToast('Using fallback viewer', 2000);
    }
    // =====================================================

    async function loadCertificate(certid) {
        const normalizedId = certid.trim().toLowerCase();
        if (!/^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/i.test(normalizedId)) {
            showError('Invalid certificate ID format. Use format like encom-26ma1-b1');
            return;
        }

        document.title = `Certificate ${normalizedId} | Lingo-Ville Verification`;

        const currentHash = window.location.hash.replace(/^#\/?/, '');
        if (currentHash !== normalizedId) {
            window.location.hash = '#/' + normalizedId;
            return;
        }

        const certPdfUrl = CERTS_PATH + normalizedId + '.pdf';
        const reportPdfUrl = CERTS_PATH + 'rep-' + normalizedId + '.pdf';

        const certExists = await pdfExists(certPdfUrl);
        if (!certExists) {
            showError(`Certificate "${normalizedId}" not found.`);
            return;
        }

        certIdDisplay.textContent = normalizedId;
        certPdfLabel.textContent = normalizedId + '.pdf';
        reportPdfLabel.textContent = 'rep-' + normalizedId + '.pdf';
        certDownloadBtn.href = certPdfUrl;
        certDownloadBtn.setAttribute('download', normalizedId + '.pdf');
        reportDownloadBtn.href = reportPdfUrl;
        reportDownloadBtn.setAttribute('download', 'rep-' + normalizedId + '.pdf');

        pdfCourseName.textContent = '—';
        pdfLevel.textContent = '—';
        pdfIssueDate.textContent = '—';
        pdfIssuer.textContent = 'Lingo‑Ville Language Centre';

        showState('certificate');
        const certGrid = certificateState?.querySelector('.grid');
        if (certGrid) certGrid.style.display = 'none';
        showInlineLoader();

        const metadata = await extractPdfMetadata(certPdfUrl);
        if (metadata) {
            if (metadata.course !== '—') pdfCourseName.textContent = metadata.course;
            if (metadata.level !== '—') pdfLevel.textContent = metadata.level;
            if (metadata.issueDate !== '—') pdfIssueDate.textContent = metadata.issueDate;
            if (metadata.issuer) pdfIssuer.textContent = metadata.issuer;
        }

        if (pdfIssueDate.textContent === '—') {
            console.warn(`Could not extract date even with OCR for ${normalizedId}.`);
        }

        hideInlineLoader();
        if (certGrid) certGrid.style.display = '';

        // Load PDF preview AFTER metadata (so container is ready)
        loadPdfPreview(certPdfUrl, certPdfContainer, pdfLoading);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function showError(msg) {
        errorMessageEl.textContent = msg || 'Certificate not found.';
        showState('error');
    }

    function navigateToCertId(certid) {
        if (!certid?.trim()) {
            if (window.location.hash) window.history.replaceState({}, '', window.location.pathname);
            showState('landing');
            return;
        }
        window.location.hash = '#/' + certid.trim().toLowerCase();
    }

    copyLinkBtn.addEventListener('click', copyVerificationLink);
    backBtn.addEventListener('click', () => {
        if (window.location.hash) window.history.replaceState({}, '', window.location.pathname);
        showState('landing');
        certIdInput.value = '';
        certIdInput.focus();
    });
    errorBackBtn.addEventListener('click', () => {
        if (window.location.hash) window.history.replaceState({}, '', window.location.pathname);
        showState('landing');
        certIdInput.value = '';
        certIdInput.focus();
    });
    searchBtn.addEventListener('click', () => {
        const val = certIdInput.value.trim();
        if (val) navigateToCertId(val);
        else showToast('Enter ID');
    });
    certIdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = certIdInput.value.trim();
            if (val) navigateToCertId(val);
            else showToast('Enter ID');
        }
    });

    window.addEventListener('hashchange', () => {
        const certid = getCertIdFromURL();
        if (certid) loadCertificate(certid);
        else showState('landing');
    });

    document.getElementById('currentYear').textContent = new Date().getFullYear();

    const initialCertId = getCertIdFromURL();
    if (initialCertId) loadCertificate(initialCertId);
    else showState('landing');
})();