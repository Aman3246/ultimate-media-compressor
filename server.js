const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.mp4': 'video/mp4'
};

http.createServer((req, res) => {
    // Default to video.html if root is accessed
    let filePath = req.url === '/' ? './video.html' : '.' + req.url;
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 File Not Found</h1>', 'utf-8');
        } else {
            // CRITICAL: Injecting the exact required security headers manually!
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Cross-Origin-Opener-Policy': 'same-origin',
                'Cross-Origin-Embedder-Policy': 'require-corp'
            });
            res.end(content, 'utf-8');
        }
    });
}).listen(PORT, () => {
    console.log(`🚀 Server running smoothly at http://localhost:${PORT}/video.html`);
});