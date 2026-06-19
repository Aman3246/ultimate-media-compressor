const { app, BrowserWindow, session } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

let server;

function startLocalServer() {
    const MIME_TYPES = {
        '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp4': 'video/mp4'
    };

    server = http.createServer((req, res) => {
        // FIXED: App install hone ke baad sahi directory se file uthane ke liye path.join ka use kiya hai
        let targetPath = req.url === '/' ? 'index.html' : req.url.substring(1);
        let filePath = path.join(__dirname, targetPath); 
        
        const extname = String(path.extname(filePath)).toLowerCase();
        const contentType = MIME_TYPES[extname] || 'application/octet-stream';

        fs.readFile(filePath, (error, content) => {
            if (error) {
                res.writeHead(404); 
                res.end('404: File Not Found in Package');
            } else {
                res.writeHead(200, { 
                    'Content-Type': contentType,
                    'Cross-Origin-Opener-Policy': 'same-origin',
                    'Cross-Origin-Embedder-Policy': 'require-corp'
                });
                res.end(content, 'utf-8');
            }
        });
    }).listen(8585);
}

function createWindow() {
    const win = new BrowserWindow({
        width: 950,
        height: 750,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    win.loadURL('http://localhost:8585');
}

app.whenReady().then(() => {
    startLocalServer();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (server) server.close();
    if (process.platform !== 'darwin') app.quit();
});