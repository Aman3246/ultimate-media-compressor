const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };

const videoInput = document.getElementById('videoInput');
const videoStatus = document.getElementById('videoStatus');
const videoDownloadBtn = document.getElementById('videoDownloadBtn');
const videoPlayer = document.getElementById('videoPlayer');

const videoResolution = document.getElementById('videoResolution');
const compressionLevel = document.getElementById('compressionLevel');
const muteAudioCheckbox = document.getElementById('muteAudioCheckbox'); 
const customDateModifier = document.getElementById('customDateModifier');
const videoDropZone = document.getElementById('videoDropZone');

let selectedFileNativePath = null;
let originalFileDate = null;
let finalOutputFilePath = null; // Backend se aane wale saved path ko track karne ke liye

// ================= 1. FILE SELECTION SYSTEM =================
videoInput.addEventListener('change', (e) => {
    handleVideoSelection(e.target.files);
});

function handleVideoSelection(files) {
    if (!files || files.length === 0) return;

    const file = files[0];
    selectedFileNativePath = file.path; 
    originalFileDate = file.lastModified ? file.lastModified : Date.now();

    document.getElementById('videoOriginalSize').innerText = `Original: ${(file.size / 1024 / 1024).toFixed(2)} MB`;
    document.getElementById('videoCompressedSize').innerText = `Compressed: Waiting...`;
    
    // Auto-start compression on selection
    startCompressionFlow();
}

function startCompressionFlow() {
    if (!selectedFileNativePath) return;

    videoPlayer.pause();
    videoPlayer.src = ""; 
    videoPlayer.style.display = 'none'; 

    videoStatus.style.display = 'block';
    videoStatus.innerText = "Status: Initializing system hardware core... [ 0% Done ]";
    videoDownloadBtn.disabled = true; 

    // Sirf video compression parameters bhejenge
    ipcRenderer.send('start-native-compression', {
        inputPath: selectedFileNativePath,
        resolution: videoResolution.value,
        crf: compressionLevel.value,
        mute: muteAudioCheckbox ? muteAudioCheckbox.checked : false
    });
}

// ================= 2. LIVE PROGRESS & BACKEND REPLIES (WAPAS AA GAYA ✨) =================
let totalVideoDurationSeconds = 0; // Duration nikalne ke liye variable

ipcRenderer.on('compression-progress', (event, log) => {
    // 1. Agar FFmpeg video ki original duration print kare, toh use seconds mein badlo
    if (log.includes('Duration:')) {
        const durationMatch = log.match(/Duration:\s*(\d+):(\d+):(\d+)/);
        if (durationMatch) {
            totalVideoDurationSeconds = (parseInt(durationMatch[1]) * 3600) + (parseInt(durationMatch[2]) * 60) + parseInt(durationMatch[3]);
        }
    }

    // 2. Continuous logs se current timestamp read karke live status aur estimation dikhana
    if (log.includes('time=')) {
        const timeMatch = log.match(/time=(\d+):(\d+):(\d+)/);
        if (timeMatch && totalVideoDurationSeconds > 0) {
            const currentSeconds = (parseInt(timeMatch[1]) * 3600) + (parseInt(timeMatch[2]) * 60) + parseInt(timeMatch[3]);
            const progressPercentage = Math.round((currentSeconds / totalVideoDurationSeconds) * 100);
            
            if (progressPercentage >= 0 && progressPercentage <= 100) {
                videoStatus.innerText = `Status: Compressing Video Logs... [ ${progressPercentage}% Done ] ⚡`;
                return;
            }
        }
        videoStatus.innerText = `Status: Processing video streams on CPU cores... 🔥`;
    }
});

// app-video.js mein sirf is block ko update karo line 69 ke aas-paas:
ipcRenderer.on('compression-complete', (event, fileDetails) => {
    const sizeInMB = (fileDetails.sizeInBytes / 1024 / 1024).toFixed(2);
    document.getElementById('videoCompressedSize').innerText = `Compressed: ${sizeInMB} MB`;
    
    videoStatus.innerText = `Status: Compression Process Completed! 🎉 [Size: ${sizeInMB} MB]`;
    
    // NO AUTO-PLAY: Sirf source load hoga, video apne aap chalegi nahi! 🤫
    videoPlayer.src = `${fileDetails.localUrl}?t=${Date.now()}`; 
    videoPlayer.style.display = 'block';
    videoPlayer.preload = "metadata"; // Sirf thumbnail aur data load hoga
    
    videoDownloadBtn.disabled = false;
});

ipcRenderer.on('save-complete', (event, msg) => {
    videoStatus.innerText = `Status: Video Saved Successfully! 🏁`;
    alert(msg);
});

ipcRenderer.on('compression-error', (event, errMsg) => {
    videoStatus.innerText = `Status: System Error occurred during execution.`;
    alert(errMsg);
});

// app-video.js ke download button click listener ko isse badlo:
videoDownloadBtn.addEventListener('click', () => {
    if (!selectedFileNativePath) return;
    
    videoStatus.innerText = "Status: Opening Save window... Choose where to save your file.";
    
    // 🔥 LIVE DATE CAPTURE: Button dabane ke theek is pal par date input se value check hogi
    let finalTimestamp = originalFileDate || Date.now();
    const customDateModifier = document.getElementById('customDateModifier');
    
    if (customDateModifier && customDateModifier.value) {
        finalTimestamp = new Date(customDateModifier.value).getTime();
    }

    // Backend ko trigger event ke sath sath custom timestamp bhi bhejenge
    ipcRenderer.send('trigger-save-dialog', {
        inputPath: selectedFileNativePath,
        customTimestamp: finalTimestamp
    });
});

// ================= 4. DRAG & DROP SYSTEM =================
if (videoDropZone) {
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
            handleVideoSelection(files);
        }
    });
}