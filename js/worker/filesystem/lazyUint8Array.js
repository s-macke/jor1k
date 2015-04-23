"use strict";

var message = require("../messagehandler");

function LazyUint8Array_length_getter() {
    if (!this.lengthKnown) {
        this.CacheLength();
    }
    return this._length;
}

function LazyUint8Array_chunkSize_getter() {
    if (!this.lengthKnown) {
        this.CacheLength();
    }
    return this._chunkSize;
}

function LazyUint8Array(url, fallbackLength) {
    this.fallbackLength = fallbackLength;
    this.overlay = [];
    this.url = url;
    this.lengthKnown = false;
    this.chunks = []; // Loaded chunks. Index is the chunk number
    Object.defineProperty(this, "length", { get: LazyUint8Array_length_getter });
    Object.defineProperty(this, "chunkSize", { get: LazyUint8Array_chunkSize_getter });
}

LazyUint8Array.prototype.Set = function LazyUint8Array_Set(idx, data) {
    if (idx > this.length-1 || idx < 0) {
        return undefined;
    }
    this.overlay[idx] = data;
}

LazyUint8Array.prototype.Get = function LazyUint8Array_Get(idx) {
    if (idx > this.length-1 || idx < 0) {
        return undefined;
    }
    if (typeof(this.overlay[idx]) !== "undefined") return this.overlay[idx];
    var chunkOffset = idx % this.chunkSize;
    var chunkNum = (idx / this.chunkSize)|0;
    return this.GetChunk(chunkNum)[chunkOffset];
}

LazyUint8Array.prototype.DoXHR = function LazyUint8Array_DoXHR(from, to) {
    if (from > to) message.Error("Invalid range (" + from + ", " + to + ") or no bytes requested!");
    if (to > this._length-1) message.Error("Only " + this._length + " bytes available! programmer error!");

    var xhr = new XMLHttpRequest();
    xhr.open('GET', this.url, false);
    if (this._length !== this._chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);

    xhr.responseType = 'arraybuffer';

    xhr.send(null);
    if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + this.url + ". Status: " + xhr.status);
    return new Uint8Array(xhr.response || []);
}

LazyUint8Array.prototype.GetChunk = function LazyUint8Array_GetChunk(chunkNum) {
    var start = chunkNum * this._chunkSize;
    var end = (chunkNum+1) * this._chunkSize - 1; // including this byte
    end = Math.min(end, this._length-1); // if length-1 is selected, this is the last block
    if (typeof(this.chunks[chunkNum]) === "undefined") {
      this.chunks[chunkNum] = this.DoXHR(start, end);
    }
    return this.chunks[chunkNum];
}

LazyUint8Array.prototype.CacheLength = function LazyUint8Array_CacheLength() {
    // Find length
    var xhr = new XMLHttpRequest();
    xhr.open('HEAD', this.url + "?" + new Date().getTime(), false);
    xhr.send(null);

    if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + this.url + ". Status: " + xhr.status);
    this._length = Number(xhr.getResponseHeader("Content-length"));
    if (this._length === 0) {
        message.Warning("Server doesn't return Content-length, even though we have a cache defeating URL query-string appended");
        this._length = this.fallbackLength;
    }

    this._chunkSize = 1024*1024; // Chunk size in bytes

    var header;
    var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
    if (!hasByteServing) this._chunkSize = this._length;

    this.lengthKnown = true;
}

module.exports = LazyUint8Array;
