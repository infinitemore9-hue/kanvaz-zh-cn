'use strict';
// Poll paths, not inodes: survives editor atomic rename/replace saves.
var fs = require('fs');
class LiveFiles {
  constructor() { this.states = new Map(); }
  async scan(paths) {
    var wanted = new Set(paths.filter(function(p) { return typeof p === 'string' && /\.(png|jpe?g|bmp|webp|gif)$/i.test(p); }).slice(0, 1000));
    for (var p of this.states.keys()) if (!wanted.has(p)) this.states.delete(p);
    var ready = [];
    for (var p of wanted) {
      try {
        var s = await fs.promises.stat(p);
        if (!s.isFile() || !s.size || s.size > 128 * 1024 * 1024) continue;
        var token = [s.mtimeMs, s.ctimeMs, s.size, s.ino].join(':');
        var old = this.states.get(p);
        this.states.set(p, token);
        if (old === token) ready.push({ path: p, token });
      } catch (_) { this.states.delete(p); }
    }
    return ready;
  }
}
module.exports = LiveFiles;
