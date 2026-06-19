// Dark Mode Toggle Logic
function toggleDarkMode() {
    const body = document.body;
    const btn = document.getElementById('themeToggleBtn');
    
    if (body.getAttribute('data-theme') === 'dark') {
        body.removeAttribute('data-theme');
        btn.innerText = "🌙 Dark Mode";
    } else {
        body.setAttribute('data-theme', 'dark');
        btn.innerText = "☀️ Light Mode";
    }
}

// Tab Switching System
function switchTab(tabId) {
    // Hide all contents
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active-content'));
    // Deactivate all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    // Show active content and set button active
    document.getElementById(tabId).classList.add('active-content');
    event.currentTarget.classList.add('active');
}

// ================= PHOTO COMPRESSION CODE (BATCH PROCESSING WITH DOWNLOAD ALL) =================
document.getElementById('imageInput').addEventListener('change', handleImageUpload);

// Ek global array banayein jisme saari compressed files save rahengi
let allCompressedFiles = []; 

async function handleImageUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const gridContainer = document.getElementById('photoPreviewGrid');
    const loadingText = document.getElementById('photoLoading');
    const downloadAllBtn = document.getElementById('photoDownloadBtn');
    
    // Naye batch ke liye array aur grid ko saaf karein
    allCompressedFiles = [];
    gridContainer.innerHTML = ""; 
    
    loadingText.style.display = 'block';
    loadingText.innerText = `Compressing ${files.length} Images... Please wait...`;

    const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 2048,
        useWebWorker: true,
        initialQuality: 0.85
    };

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        try {
            const compressedFile = await imageCompression(file, options);
            
            // File ko array mein push karein taaki baad mein ek sath download ho sake
            allCompressedFiles.push({
                blob: compressedFile,
                name: `compressed_${file.name}`
            });

            // Card create karne ka logic
            const card = document.createElement('div');
            card.className = 'photo-item-card';
            
            const origSize = (file.size / 1024 / 1024).toFixed(2);
            const compSize = (compressedFile.size / 1024 / 1024).toFixed(2);
            const blobUrl = URL.createObjectURL(compressedFile);

            card.innerHTML = `
                <img src="${blobUrl}">
                <div style="font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${file.name}</div>
                <div style="color:var(--sub-text); margin:4px 0;">${origSize}MB ➡️ ${compSize}MB</div>
                <button class="btn-download-single" onclick="downloadSinglePhoto('${blobUrl}', 'compressed_${file.name}')">Download</button>
            `;
            
            gridContainer.appendChild(card);

        } catch (error) {
            console.error("Error compressing file:", file.name, error);
        }
    }

    loadingText.style.display = 'none';

    // Agar files successfully compress hui hain, toh "Download All" button chalu karo
    if (allCompressedFiles.length > 0) {
        downloadAllBtn.disabled = false;
        downloadAllBtn.style.display = 'block'; // Ensure it's visible
    }
}

// Single Photo Download Function
function downloadSinglePhoto(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
}

// MULTIPLE DOWNLOAD ALL TRIGGER (Ab asli .zip file banegi)
document.getElementById('photoDownloadBtn').addEventListener('click', async () => {
    if (allCompressedFiles.length === 0) return;

    const downloadAllBtn = document.getElementById('photoDownloadBtn');
    const loadingText = document.getElementById('photoLoading');
    
    downloadAllBtn.disabled = true;
    loadingText.style.display = 'block';
    loadingText.innerText = "Creating ZIP folder... Please wait...";

    // 1. JSZip ka naya instance banayein
    const zip = new JSZip();

    // 2. Loop chalakar saari compressed files ko ZIP ke andar add karein
    allCompressedFiles.forEach((fileObj) => {
        zip.file(fileObj.name, fileObj.blob);
    });

    try {
        // 3. ZIP file generate karein (Asynchronous format)
        const zipContent = await zip.generateAsync({ type: "blob" });

        // 4. Pure ZIP package ko ek sath download trigger karein
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipContent);
        link.download = `compressed_photos_${Date.now()}.zip`; // Unique ZIP name
        link.click();

        // Safe memory management
        setTimeout(() => URL.revokeObjectURL(link.href), 2000);

    } catch (error) {
        console.error("ZIP Generation Error:", error);
        alert("Could not generate ZIP file.");
    }

    loadingText.style.display = 'none';
    downloadAllBtn.disabled = false;
});

// ================= PHOTO DRAG & DROP SYSTEM =================
const photoDropZone = document.getElementById('photoDropZone');
const imageInput = document.getElementById('imageInput');

// Browser ke default action ko rokna (nahi toh file pure screen par khul jayegi)
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    photoDropZone.addEventListener(eventName, (e) => e.preventDefault(), false);
});

// Jab file box ke upar mandraye (Animation ON)
['dragenter', 'dragover'].forEach(eventName => {
    photoDropZone.addEventListener(eventName, () => photoDropZone.classList.add('drag-over'), false);
});

// Jab file box se bahar chali jaye (Animation OFF)
['dragleave', 'drop'].forEach(eventName => {
    photoDropZone.addEventListener(eventName, () => photoDropZone.classList.remove('drag-over'), false);
});

// Jab file ko box par choda (Drop) jaye
photoDropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
        imageInput.files = files; // Input element ko file assign karna
        handleImageUpload({ target: { files: files } }); // Purane function ko trigger karna
    }
});