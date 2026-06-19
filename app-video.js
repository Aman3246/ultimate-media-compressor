const { createFFmpeg, fetchFile } = FFmpeg;

const ffmpeg = createFFmpeg({ 
    log: true,
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
});

const videoInput = document.getElementById('videoInput');
const videoStatus = document.getElementById('videoStatus');
const videoDownloadBtn = document.getElementById('videoDownloadBtn');
const videoPlayer = document.getElementById('videoPlayer');

const videoResolution = document.getElementById('videoResolution');
const compressionLevel = document.getElementById('compressionLevel');
const muteAudioCheckbox = document.getElementById('muteAudioCheckbox'); // New checkbox element

let compressedVideoUrl = null;

ffmpeg.setProgress(({ ratio }) => {
    const percentage = Math.round(ratio * 100);
    if (percentage >= 0 && percentage <= 100) {
        videoStatus.innerText = `Status: Compressing Video... [ ${percentage}% Done ]`;
    }
});

videoInput.addEventListener('change', async (e) => {
    if (!e.target.files || e.target.files.length === 0) {
        videoStatus.innerText = "Status: No file selected.";
        return;
    }

    const file = e.target.files[0];
    if (!file.size) {
        videoStatus.innerText = "Status: Invalid file object.";
        return;
    }

    let fileExtension = "mp4"; 
    if (file.name && file.name.includes('.')) {
        fileExtension = file.name.split('.').pop().toLowerCase();
    }
    const inputFileName = `input.${fileExtension}`;

    document.getElementById('videoOriginalSize').innerText = `Original: ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    videoDownloadBtn.disabled = true;
    
    videoStatus.innerText = "Status: Initializing FFmpeg core module...";

    try {
        if (!ffmpeg.isLoaded()) {
            await ffmpeg.load();
        }
    } catch (err) {
        videoStatus.innerText = "Status: Error loading compiler engine.";
        console.error(err);
        return;
    }

    videoStatus.innerText = "Status: Starting compression... [ 0% Done ]";

    try {
        ffmpeg.FS('writeFile', inputFileName, await fetchFile(file));

        const selectedRes = videoResolution.value; 
        const selectedCRF = compressionLevel.value;  
        const shouldMute = muteAudioCheckbox.checked; // Checkbox true hai ya false

        // Basic compression config array
        let ffmpegArgs = ['-i', inputFileName, '-vcodec', 'libx264', '-crf', selectedCRF];

        // 1. Resolution change filter setup
        if (selectedRes !== 'original') {
            ffmpegArgs.push('-vf', `scale=${selectedRes}:-2`);
        }

        // 2. AUDIO MUTE LOGIC: Agar box checked hai toh '-an' argument insert karo
        if (shouldMute) {
            ffmpegArgs.push('-an'); // -an stands for 'Audio None' in FFmpeg
        }

        // Out path parameters
        ffmpegArgs.push('-preset', 'ultrafast', 'output.mp4');

        await ffmpeg.run(...ffmpegArgs);

        videoStatus.innerText = "Status: Compression Process Completed! 🎉";

        const data = ffmpeg.FS('readFile', 'output.mp4');
        const compressedBlob = new Blob([data.buffer], { type: 'video/mp4' });
        
        document.getElementById('videoCompressedSize').innerText = `Compressed: ${(compressedBlob.size / 1024 / 1024).toFixed(2)} MB`;

        if (compressedVideoUrl) {
            URL.revokeObjectURL(compressedVideoUrl);
        }
        compressedVideoUrl = URL.createObjectURL(compressedBlob);
        videoPlayer.src = compressedVideoUrl;
        videoPlayer.style.display = 'block';
        
        videoDownloadBtn.disabled = false;

    } catch (error) {
        videoStatus.innerText = "Status: System Error occurred during execution.";
        console.error(error);
    }
});

videoDownloadBtn.addEventListener('click', () => {
    if (!compressedVideoUrl) return;
    const a = document.createElement('a');
    a.href = compressedVideoUrl;
    a.download = 'compressed_video.mp4';
    a.click();
});

// ================= VIDEO DRAG & DROP SYSTEM =================
const videoDropZone = document.getElementById('videoDropZone');

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    videoDropZone.addEventListener(eventName, (e) => e.preventDefault(), false);
});

['dragenter', 'dragover'].forEach(eventName => {
    videoDropZone.addEventListener(eventName, () => videoDropZone.classList.add('drag-over'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    videoDropZone.addEventListener(eventName, () => videoDropZone.classList.remove('drag-over'), false);
});

videoDropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
        videoInput.files = files;
        // Hamare purane event listener ko fake event de kar trigger karna
        videoInput.dispatchEvent(new Event('change')); 
    }
});