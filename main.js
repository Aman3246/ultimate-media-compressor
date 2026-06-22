const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let server;
let appOutputDir = '';
// Standard local server static files load karne ke liye
function startLocalServer() {
    const MIME_TYPES = {
        '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp4': 'video/mp4', '.mkv': 'video/mp4'
    };

    server = http.createServer((req, res) => {
        let targetPath = req.url === '/' ? 'index.html' : req.url.substring(1);
        targetPath = targetPath.split('?')[0]; 
        let filePath = path.join(__dirname, targetPath); 

        // 🔥 LOCAL DRIVE SERVER ROUTING: 
        if (!fs.existsSync(filePath)) {
            const baseDir = app.isPackaged ? path.dirname(app.getPath('exe')) : __dirname;
            filePath = path.join(baseDir, 'temp_outputs', targetPath);
        }
        const extname = String(path.extname(filePath)).toLowerCase();
        const contentType = MIME_TYPES[extname] || 'application/octet-stream';

        // AGAR VIDEO STREAMING KI REQUEST HAI (PREVIEW PLAYER KE LIYE)
        if (extname === '.mp4' || extname === '.mkv') {
            if (!fs.existsSync(filePath)) {
                res.writeHead(404);
                res.end('Video not found');
                return;
            }

            const stat = fs.statSync(filePath);
            const fileSize = stat.size;
            const range = req.headers.range;

            if (range) {
                // Browser chunks range handle karein (206 Partial Content support)
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                const chunksize = (end - start) + 1;
                const file = fs.createReadStream(filePath, { start, end });
                
                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': contentType,
                });
                file.pipe(res);
            } else {
                res.writeHead(200, {
                    'Content-Length': fileSize,
                    'Content-Type': contentType,
                });
                fs.createReadStream(filePath).pipe(res);
            }
        } else {
            // NORMAL BAKI STATIC FILES (HTML, CSS, JS) LEAK HANDLING
            fs.readFile(filePath, (error, content) => {
                if (error) {
                    res.writeHead(404); 
                    res.end('404: File Not Found');
                } else {
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(content, 'utf-8');
                }
            });
        }
    }).listen(8585);
}

function createWindow() {
    const win = new BrowserWindow({
        width: 950,
        height: 750,
        webPreferences: {
            nodeIntegration: true,     // CRITICAL: Backend access chalu karne ke liye
            contextIsolation: false   // Frontend se direct communication ke liye
        }
    });

    win.loadURL('http://localhost:8585');
}

// ASLI DESKTOP HARDWARE COMPRESSION ENGINE (NO RAM LIMIT)
let tempCompressedPath = ''; // Temporary storage tracking ke liye
let finalModifiedTimeGlobal = null;


// 1. Sabse upar global scope mein process track karne ke liye variable banao (Line 72 ke paas)
let activeFmpegeProcess = null; 

// 1. FILE SELECT HOTE HI COMPRESSION SHURU
ipcMain.on('start-native-compression', async (event, data) => {
    const { inputPath, resolution, crf, mute, customTimestamp } = data;
    finalModifiedTimeGlobal = customTimestamp;

    const ext = path.extname(inputPath);
    
    // 🔥 BULLETPROOF D-DRIVE FIX: Production ho ya local development, resourcesPath ka use karke unpacked space mein folder banega
    const baseDir = app.isPackaged ? path.dirname(app.getPath('exe')) : __dirname;
    const localTempDir = path.join(baseDir, 'temp_outputs');
    
    if (!fs.existsSync(localTempDir)) {
        try {
            fs.mkdirSync(localTempDir, { recursive: true });
        } catch (e) {
            console.error("Folder creation failed:", e);
        }
    }
    
    // Final temporary path local folder par set kiya
    tempCompressedPath = path.join(localTempDir, `temp_${Date.now()}${ext}`);

    if (activeFmpegeProcess) {
        try {
            activeFmpegeProcess.kill('SIGKILL');
            activeFmpegeProcess = null;
        } catch (e) {}
    }

    // 🔥 FIX 2: PRODUCTION BUILD (.exe) PATH RESOLUTION
    let ffmpegPath = path.join(__dirname, 'ffmpeg.exe');
    if (app.isPackaged) {
        ffmpegPath = path.join(app.getAppPath(), '..', 'app.asar.unpacked', 'ffmpeg.exe');
    } else if (ffmpegPath.includes('app.asar')) {
        ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
    }

    console.log("Executing FFmpeg from safe path:", ffmpegPath);

    let ffmpegArgs = ['-y', '-i', inputPath, '-vcodec', 'libx264', '-maxrate', '5M', '-bufsize', '10M', '-crf', crf];

    if (resolution !== 'original') {
        ffmpegArgs.push('-vf', `scale=${resolution}:-2`);
    }
    if (mute) {
        ffmpegArgs.push('-an');
    }
    ffmpegArgs.push('-preset', 'ultrafast', tempCompressedPath);

    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
    activeFmpegeProcess = ffmpegProcess;

    ffmpegProcess.stderr.on('data', (data) => {
        event.reply('compression-progress', data.toString());
    });

    ffmpegProcess.on('close', (code) => {
        activeFmpegeProcess = null;
        
        if (code === 0 && fs.existsSync(tempCompressedPath)) {
            const stats = fs.statSync(tempCompressedPath);
            
            // 🔥 PREVIEW FIX 2: Global variable mein temp directory set karo aur network URL bhejo
            appOutputDir = path.dirname(tempCompressedPath);

            event.reply('compression-complete', { 
                sizeInBytes: stats.size,
                localUrl: `http://localhost:8585/${path.basename(tempCompressedPath)}` // Pure secure network stream path
            });
        } else {
            if (code !== null) {
                event.reply('compression-error', 'FFmpeg processing crash occurred.');
            }
        }
    });
});

// 2. JAB USER DOWNLOAD BUTTON DABAYE
// main.js ke andar trigger-save-dialog block ko isse badlo:
ipcMain.on('trigger-save-dialog', async (event, data) => {
    if (!tempCompressedPath || !fs.existsSync(tempCompressedPath)) {
        event.reply('compression-error', 'Compressed file not found.');
        return;
    }

    // Frontend se input path aur fresh selected timestamp dono receive kiya
    const { inputPath, customTimestamp } = data;
    const ext = path.extname(inputPath);

    const { filePath: outputPath } = await dialog.showSaveDialog({
        title: 'Save Compressed Video',
        defaultPath: path.join(app.getPath('downloads'), `compressed_${path.basename(inputPath)}`),
        filters: [{ name: 'Movies', extensions: [ext.substring(1)] }]
    });

    if (!outputPath) {
        return; // User cancelled the window
    }

    try {
        // 1. Temporary file ko final location par copy karo
        fs.copyFileSync(tempCompressedPath, outputPath);
        
        if (customTimestamp) {
            const finalTime = new Date(customTimestamp);
            
            // Format time for PowerShell (MM/DD/YYYY HH:MM:SS)
            const formattedDate = `${finalTime.getMonth() + 1}/${finalTime.getDate()}/${finalTime.getFullYear()} ${finalTime.getHours()}:${finalTime.getMinutes()}:${finalTime.getSeconds()}`;

            // 2. 🔥 Date Modified badlo (Standard Node.js Function)
            fs.utimesSync(outputPath, finalTime, finalTime);

            // 3. 🔥 DATE CREATED BADLO (Windows Native PowerShell Command)
            // Yeh command seedhe file ki 'CreationTime' property ko override kar dega
            const psCommand = `powershell -Command "(Get-Item '${outputPath.replace(/'/g, "''")}').CreationTime = '${formattedDate}'"`;
            
            const { exec } = require('child_process');
            exec(psCommand, (err) => {
                if (err) {
                    console.error("PowerShell Date Created modification failed:", err);
                } else {
                    console.log("Date Created successfully changed via PowerShell! ✨");
                }
            });
        }
        
        // Temporary space clean up
        try { fs.unlinkSync(tempCompressedPath); } catch(e){}

        event.reply('save-complete', `🎉 Video Successfully Saved at:\n${outputPath}`);
    } catch (err) {
        console.error("Metadata modification error: ", err);
        event.reply('compression-error', 'Error while saving the file or writing custom metadata properties.');
    }
});

app.whenReady().then(() => {
    startLocalServer();
    createWindow();
});

app.on('window-all-closed', () => {
    if (server) server.close();
    if (process.platform !== 'darwin') app.quit();
});