// -------------------------------------------------------------------------
// Minimal static dev server with cross-origin isolation enabled.
//
// SharedArrayBuffer (needed for the multi-core / shared-memory paths) is only
// exposed by browsers when the document is "cross-origin isolated", which
// requires the COOP and COEP response headers below. GitHub Pages cannot set
// these headers, so use this server (or a host that can, e.g. Netlify /
// Cloudflare Pages via demos/_headers) when experimenting with shared memory.
//
//   node tools/serve.js [port] [rootdir]
//   npm run serve
//
// Then open  http://localhost:8000/demos/main.html
// -------------------------------------------------------------------------
"use strict";

var http = require("http");
var fs = require("fs");
var path = require("path");

var port = parseInt(process.argv[2], 10) || 8000;
var root = path.resolve(process.argv[3] || ".");

var MIME = {
    ".html": "text/html",          ".js": "text/javascript",
    ".mjs": "text/javascript",     ".css": "text/css",
    ".json": "application/json",    ".wasm": "application/wasm",
    ".png": "image/png",           ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",         ".gif": "image/gif",
    ".svg": "image/svg+xml",       ".ico": "image/x-icon",
    ".bz2": "application/x-bzip2",  ".bin": "application/octet-stream",
    ".tar": "application/x-tar",    ".wav": "audio/wav"
};

http.createServer(function (req, res) {
    var urlPath = decodeURIComponent(req.url.split("?")[0]);
    var filePath = path.join(root, urlPath);

    // Never escape the served root.
    if (filePath.indexOf(root) !== 0) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
    }

    fs.stat(filePath, function (err, stat) {
        if (!err && stat.isDirectory()) filePath = path.join(filePath, "index.html");
        fs.readFile(filePath, function (err2, data) {
            if (err2) {
                res.writeHead(404);
                res.end("Not found: " + urlPath);
                return;
            }
            // Cross-origin isolation -> enables SharedArrayBuffer.
            res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
            res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
            res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
            res.setHeader("Content-Type", MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream");
            res.writeHead(200);
            res.end(data);
        });
    });
}).listen(port, function () {
    console.log("jor1k dev server (cross-origin isolated) running:");
    console.log("  http://localhost:" + port + "/demos/main.html");
    console.log("  root = " + root);
    console.log("SharedArrayBuffer is available on this origin.");
});
