import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

const state = {
    mediaFiles: [],
    ffmpeg: null,
    loaded: false,
    outputData: null,
};

const $ = (id) => document.getElementById(id);
const dropZone = $('dropZone');
const fileInput = $('fileInput');
const mediaSection = $('mediaSection');
const mediaList = $('mediaList');
const createBtn = $('createBtn');
const downloadBtn = $('downloadBtn');
const progressSection = $('progressSection');
const progressFill = $('progressFill');
const progressText = $('progressText');
const sarPrice = $('sarPrice');
const yerPrice = $('yerPrice');
const optionSelect = $('optionSelect');
const speedSelect = $('speedSelect');

init();
setupEvents();

async function init() {
    try {
        const base = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
        state.ffmpeg = new FFmpeg();

        state.ffmpeg.on('progress', ({ progress }) => {
            const pct = Math.min(progress * 100, 99);
            progressFill.style.width = `${pct}%`;
            progressText.textContent = `جاري المعالجة... ${Math.round(pct)}%`;
        });

        await state.ffmpeg.load({
            coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
        });

        state.loaded = true;
        console.log('FFmpeg ready');
    } catch (err) {
        console.error('FFmpeg init failed:', err);
        progressText.textContent = '❌ فشل تحميل المحرك. تحقق من الاتصال بالإنترنت.';
        progressSection.style.display = 'block';
    }
}

function setupEvents() {
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', () => {
        handleFiles(fileInput.files);
        fileInput.value = '';
    });

    createBtn.addEventListener('click', createVideo);
    downloadBtn.addEventListener('click', downloadVideo);
    sarPrice.addEventListener('input', checkCanCreate);
    yerPrice.addEventListener('input', checkCanCreate);
}

function checkCanCreate() {
    createBtn.disabled = !(state.mediaFiles.length > 0 && state.loaded);
}

// ─── File Handling ───────────────────────────────────────────────────────────

async function handleFiles(files) {
    const entries = [];

    for (const file of files) {
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue;

        const type = file.type.startsWith('image') ? 'image' : 'video';
        entries.push({
            id: Date.now() + Math.random(),
            file,
            type,
            duration: type === 'image' ? 3 : null,
            thumb: await genThumb(file, type),
        });
    }

    state.mediaFiles.push(...entries);
    renderMedia();
    checkCanCreate();
}

function genThumb(file, type) {
    return new Promise((resolve) => {
        if (type === 'image') {
            const r = new FileReader();
            r.onload = (e) => resolve(e.target.result);
            r.readAsDataURL(file);
        } else {
            const v = document.createElement('video');
            v.preload = 'metadata';
            v.muted = true;
            v.onloadeddata = () => {
                const c = document.createElement('canvas');
                c.width = 120;
                c.height = 90;
                c.getContext('2d').drawImage(v, 0, 0, 120, 90);
                resolve(c.toDataURL());
                URL.revokeObjectURL(v.src);
                v.remove();
            };
            v.onerror = () => {
                resolve('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect fill="%23eee" width="120" height="90"/><text x="60" y="50" text-anchor="middle" fill="%23999" font-size="28">🎬</text></svg>');
                v.remove();
            };
            v.src = URL.createObjectURL(file);
        }
    });
}

// ─── Media List (Drag & Drop) ───────────────────────────────────────────────

function renderMedia() {
    if (!state.mediaFiles.length) {
        mediaSection.style.display = 'none';
        return;
    }

    mediaSection.style.display = 'block';
    mediaList.innerHTML = '';

    state.mediaFiles.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'media-item';
        div.draggable = true;
        div.dataset.id = item.id;

        const name = item.file.name.length > 30
            ? item.file.name.slice(0, 27) + '...'
            : item.file.name;

        div.innerHTML = `
            <span class="drag-handle">⠿</span>
            <img class="thumb" src="${item.thumb}" alt="">
            <div class="info">
                <div class="name" title="${item.file.name}">${name}</div>
                <div class="type">${item.type === 'image' ? '🖼️ صورة' : '🎬 فيديو'}</div>
            </div>
            ${item.type === 'image'
                ? `<input class="dur-input" type="number" min="1" max="60" value="${item.duration}" data-id="${item.id}"><span class="dur-label">ث</span>`
                : ''}
            <button class="del-btn" data-id="${item.id}">✕</button>
        `;

        div.querySelector('.del-btn').addEventListener('click', () => {
            state.mediaFiles = state.mediaFiles.filter((m) => m.id !== item.id);
            renderMedia();
            checkCanCreate();
        });

        const durInput = div.querySelector('.dur-input');
        if (durInput) {
            durInput.addEventListener('change', () => {
                const entry = state.mediaFiles.find((m) => m.id === item.id);
                if (entry) entry.duration = Math.max(1, parseInt(durInput.value, 10) || 3);
            });
        }

        // Drag & Drop
        div.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', String(item.id));
            div.classList.add('dragging');
        });

        div.addEventListener('dragend', () => {
            div.classList.remove('dragging');
            document.querySelectorAll('.media-item').forEach((el) => el.classList.remove('drag-over'));
        });

        div.addEventListener('dragover', (e) => {
            e.preventDefault();
            div.classList.add('drag-over');
        });

        div.addEventListener('dragleave', () => {
            div.classList.remove('drag-over');
        });

        div.addEventListener('drop', (e) => {
            e.preventDefault();
            div.classList.remove('drag-over');
            document.querySelectorAll('.media-item').forEach((el) => el.classList.remove('drag-over'));

            const fromId = Number(e.dataTransfer.getData('text/plain'));
            const toId = item.id;
            if (fromId === toId) return;

            const from = state.mediaFiles.findIndex((m) => m.id === fromId);
            const to = state.mediaFiles.findIndex((m) => m.id === toId);
            if (from === -1 || to === -1) return;

            const [moved] = state.mediaFiles.splice(from, 1);
            state.mediaFiles.splice(to, 0, moved);
            renderMedia();
        });

        mediaList.appendChild(div);
    });
}

// ─── Text Formatting ─────────────────────────────────────────────────────────

const arabicMap = {
    '\u0660': '0', '\u0661': '1', '\u0662': '2', '\u0663': '3', '\u0664': '4',
    '\u0665': '5', '\u0666': '6', '\u0667': '7', '\u0668': '8', '\u0669': '9',
};

function toEnglishNum(str) {
    return str.replace(/[\u0660-\u0669]/g, (c) => arabicMap[c]);
}

function getTextLines() {
    const sar = toEnglishNum(sarPrice.value.trim());
    const yer = toEnglishNum(yerPrice.value.trim());
    const opt = optionSelect.value;
    const lines = [];

    if (sar) lines.push(`\u0627\u0644\u0633\u0639\u0631 \u0628\u0627\u0644\u0631\u064A\u0627\u0644 \u0627\u0644\u0633\u0639\u0648\u062F\u064A ${sar}\u{FDFC} \u{1F1F8}\u{1F1E6}`);
    if (yer) lines.push(`\u0627\u0644\u0633\u0639\u0631 \u0628\u0627\u0644\u0631\u064A\u0627\u0644 \u0627\u0644\u064A\u0645\u0646\u064A ${yer} \u0631\u064A\u0627\u0644 \u{1F1FE}\u{1F1EA}`);
    lines.push(opt);

    return lines;
}

function escapeFilterText(text) {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "'\\''")
        .replace(/:/g, '\\:')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');
}

// ─── Video Duration ──────────────────────────────────────────────────────────

function getVideoDuration(file) {
    return new Promise((resolve, reject) => {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.muted = true;
        v.onloadedmetadata = () => {
            resolve(v.duration);
            URL.revokeObjectURL(v.src);
            v.remove();
        };
        v.onerror = () => {
            reject(new Error('Cannot read video'));
            v.remove();
        };
        v.src = URL.createObjectURL(file);
    });
}

// ─── Progress ────────────────────────────────────────────────────────────────

function setProgress(pct, text) {
    progressFill.style.width = `${Math.min(pct, 100)}%`;
    if (text) progressText.textContent = text;
}

// ─── Create Video ────────────────────────────────────────────────────────────

async function createVideo() {
    if (!state.loaded || !state.mediaFiles.length) return;

    createBtn.disabled = true;
    downloadBtn.style.display = 'none';
    progressSection.style.display = 'block';
    setProgress(0, 'جارٍ التجهيز...');

    const speed = parseFloat(speedSelect.value);
    const textLines = getTextLines();
    const ffmpeg = state.ffmpeg;

    try {
        // 1. Load Arabic font
        setProgress(1, 'تحميل الخط العربي...');
        const fontResp = await fetch(
            'https://raw.githubusercontent.com/google/fonts/main/ofl/notosansarabic/NotoSansArabic%5Bwdth,wght%5D.ttf'
        );
        if (!fontResp.ok) throw new Error('Failed to load font');
        const fontBuf = await fontResp.arrayBuffer();
        await ffmpeg.writeFile('font.ttf', new Uint8Array(fontBuf));

        // 2. Process each file into a segment
        const segNames = [];
        const segDurs = [];
        const total = state.mediaFiles.length;

        for (let i = 0; i < total; i++) {
            const item = state.mediaFiles[i];
            const segName = `s${i}.mp4`;
            segNames.push(segName);

            setProgress(3 + (i / total) * 20, `معالجة ${item.file.name}...`);

            await ffmpeg.writeFile(`in_${i}`, await fetchFile(item.file));

            if (item.type === 'image') {
                const dur = Math.max(item.duration || 3, 1);
                const fadeD = Math.min(0.5, dur / 5);
                const fadeOutStart = Math.max(0, dur - fadeD);
                segDurs.push(dur);

                await ffmpeg.exec([
                    '-loop', '1',
                    '-framerate', '30',
                    '-i', `in_${i}`,
                    '-vf',
                    `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fade=t=in:st=0:d=${fadeD},fade=t=out:st=${fadeOutStart}:d=${fadeD}`,
                    '-c:v', 'libx264',
                    '-preset', 'ultrafast',
                    '-t', String(dur),
                    '-r', '30',
                    '-pix_fmt', 'yuv420p',
                    '-an',
                    segName,
                ]);
            } else {
                const dur = await getVideoDuration(item.file);
                const fadeD = Math.min(0.5, dur / 5);
                const fadeOutStart = Math.max(0, dur - fadeD);
                segDurs.push(dur);

                await ffmpeg.exec([
                    '-i', `in_${i}`,
                    '-vf',
                    `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fade=t=in:st=0:d=${fadeD},fade=t=out:st=${fadeOutStart}:d=${fadeD}`,
                    '-c:v', 'libx264',
                    '-preset', 'ultrafast',
                    '-r', '30',
                    '-pix_fmt', 'yuv420p',
                    '-an',
                    segName,
                ]);
            }
        }

        // 3. Build filtergraph: concat → speed → text
        setProgress(30, 'بناء الفلتر النهائي...');

        const filterParts = [];

        // Concat all segments (concat ignores input timestamps)
        const inputRefs = segNames.map((_, i) => `[${i}:v]`).join('');
        filterParts.push(`${inputRefs}concat=n=${segNames.length}:v=1:a=0[concatv]`);

        let prevLabel = 'concatv';

        // Apply speed globally (after concat so timestamps are fresh)
        if (speed !== 1) {
            filterParts.push(`[concatv]setpts=PTS/${speed}[spedv]`);
            prevLabel = 'spedv';
        }

        // Drawtext overlays (fontsize 20, bottom-center, first 5s only)
        if (textLines.length > 0) {
            const drawFilters = textLines.map((line, i) => {
                const fromBottom = textLines.length - 1 - i;
                const y = `h-${(fromBottom + 1) * 26}`;
                const esc = escapeFilterText(line);
                return `drawtext=text='${esc}':fontfile=font.ttf:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.4:x=(w-text_w)/2:y=${y}:enable='lt(t,5)'`;
            });
            filterParts.push(`[${prevLabel}]${drawFilters.join(',')}[outv]`);
            prevLabel = 'outv';
        }

        const filterComplex = filterParts.join(';');

        // 4. Run final concat + effects
        setProgress(35, 'دمج المقاطع وتطبيق التأثيرات...');

        const args = [
            ...segNames.flatMap((s) => ['-i', s]),
            '-filter_complex', filterComplex,
            '-map', `[${prevLabel}]`,
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-pix_fmt', 'yuv420p',
            'output.mp4',
        ];

        await ffmpeg.exec(args);

        // 5. Read output
        setProgress(95, 'تجهيز الفيديو للتحميل...');
        state.outputData = await ffmpeg.readFile('output.mp4');

        setProgress(100, '✅ تم إنشاء الفيديو بنجاح!');
        downloadBtn.style.display = 'inline-block';

    } catch (err) {
        console.error('CreateVideo error:', err);
        setProgress(0, `❌ خطأ: ${err.message || 'حدث خطأ غير متوقع'}`);
    } finally {
        createBtn.disabled = false;
    }
}

// ─── Download ─────────────────────────────────────────────────────────────────

function downloadVideo() {
    if (!state.outputData) return;

    const blob = new Blob([state.outputData], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'video_final.mp4';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}
