# Performance & Scalability

This document describes the performance and scalability work layered on top of
jor1k, how to verify each change, and the roadmap for true multi-core SMP.

The changes are deliberately split so the proven default boot path (OpenRISC on
the asm.js core) is never destabilised; the riskier, parallelism-oriented pieces
are opt-in.

## Summary of changes

| Area | Change | Effect |
| --- | --- | --- |
| Load time / footprint | Bundles are now actually minified (esbuild) | worker bundle **622 KB → 213 KB (-66%)**, master **61 KB → 31 KB (-49%)** |
| CPU throughput | The `wasm` and `dynamic` backends were broken because `demos/*.wasm` were never built; they are now produced by `./compile` | `?cpu=wasm` / `?cpu=dynamic` work (faster than the interpreter) |
| Zero-copy I/O | Framebuffer frames are handed to the main thread as a `Transferable` instead of being structured-clone copied | no per-frame ~512 KB deep copy; less main-thread jank |
| Scalability | Opt-in `SharedArrayBuffer` heap + cross-origin-isolation tooling | foundation for one Web Worker per core |
| Tooling | `npm test` fixed (was requiring a non-existent module), modern devDeps | a real, framework-free regression gate |

## 1. Load time & footprint

The committed `demos/jor1k-*-min.js` files were **not** minified despite the
`-min` suffix — the old `compile` script ran browserify with no minify step.
The bundles are now piped through `esbuild --minify`:

* `jor1k-worker-min.js`: 621,947 → ~213,000 bytes (-66%)
* `jor1k-master-min.js`: 60,899 → ~31,000 bytes (-49%)

browserify is still used for bundling so the global `require("Jor1k")` /
`require("LinuxTerm")` interface the demo HTML depends on is preserved exactly;
esbuild only minifies the already-bundled output.

Build everything with:

```sh
npm install      # installs browserify + esbuild
npm run build    # == ./compile : wasm cores + minified bundles
```

## 2. CPU throughput

`demos/or1k.wasm` and `demos/riscv.wasm` are required by the `wasm` and
`dynamic` CPU backends (see `js/worker/or1k/index.js` → `createCPUWasm`) but were
absent from the repository, so selecting those backends failed silently. They
are now built by `./compile` (needs `clang` + `wasm-ld` with the `wasm32`
target) and validated: `or1k.wasm` exports every function the facade imports.

The OpenRISC default remains `asm` (the mature, well-tested core). To try the
WebAssembly core, append `?cpu=wasm` to a demo URL. The interpreter hot path was
intentionally left untouched: it is already hand-optimised and cannot be changed
safely without an in-browser Linux boot to verify against.

## 3. Zero-copy I/O

`message.Send(command, data)` gained an optional third argument, a list of
[Transferable](https://developer.mozilla.org/docs/Web/API/Web_Workers_API/Transferable_objects)
objects, in both the master and worker message handlers. Passing it makes
`postMessage` hand over ownership of the backing `ArrayBuffer` instead of
deep-copying it.

The framebuffer device now uses this: each frame is filled from RAM into an
`Int32Array` which is transferred to the main thread (and a fresh buffer is
allocated for the next frame). Previously every frame structured-clone copied
~512 KB (640×400) from the worker to the main thread.

This needs no special headers and works on every host, including GitHub Pages.

## 4. Scalability: toward true multi-core SMP

Today "SMP" (`?cpu=smp`) runs every core **in a single worker thread**, round-
robin — so adding cores does not add parallelism and, past a few cores, slows
the system down. Real scaling needs one Web Worker per core sharing one heap.

The prerequisite for that is a `SharedArrayBuffer` heap, which a browser only
exposes when the page is **cross-origin isolated** (COOP + COEP). This change
set lays that foundation:

* **Opt-in shared heap** — `System.Init` allocates the heap as a
  `SharedArrayBuffer` when the system config has `shared: true` and the runtime
  supports it (falling back to `ArrayBuffer`). It is opt-in because some engines
  refuse to apply the asm.js fast path to a shared heap, which would *slow down*
  the default core — so the default path is left exactly as it was.
* **Cross-origin isolation tooling** — `npm run serve` (`tools/serve.js`) is a
  static dev server that sends the COOP/COEP headers, and `demos/_headers`
  provides them for Netlify / Cloudflare Pages. GitHub Pages cannot set headers,
  so `SharedArrayBuffer` is unavailable there and the code falls back cleanly.

### Remaining work for parallel SMP (not yet implemented)

A correct multi-worker executor still needs:

1. **Per-core workers.** Spawn N workers, each running a CPU core over the shared
   heap (CPU register banks already live at distinct heap offsets — see the heap
   layout in `js/worker/init_openrisc.js`).
2. **A device owner.** Devices (UART, virtio, the 9p filesystem, ATA, …) assume
   single-threaded access today. They must live in one place (a dedicated worker
   or the master) and be reached from core workers via an `Atomics`-based
   request/response on the shared heap, since device MMIO is synchronous.
3. **Atomic LL/SC.** `l.lwa` / `l.swa` (load-linked / store-conditional) and the
   tick timer must use `Atomics` so cross-core synchronisation primitives work.
4. **Interrupt routing.** `RaiseInterrupt(line, cpuid)` must signal the target
   core's worker (e.g. via `Atomics.notify`).

This is a substantial re-architecture and must be validated against a real
in-browser SMP Linux boot; it is intentionally staged behind the foundation
above rather than shipped half-working.

## Verifying in a browser

These changes cannot be validated headlessly (no Linux boot in CI), so verify in
a browser:

1. `git submodule update --init --recursive` (fetches the kernel + root
   filesystem from the `openrisc-sys` / `riscv-sys` submodules; without this the
   demos request `../openrisc-sys/...`, get the server's 404 HTML page, and fail
   with `Unexpected token '<' ... is not valid JSON`).
2. `npm install && npm run build`
3. `npm run serve` and open `http://localhost:8000/demos/main.html`
4. Confirm Linux boots and the terminal is responsive (zero-copy framebuffer,
   minified bundles).
5. Try `http://localhost:8000/demos/main.html?cpu=wasm` for the WebAssembly core.
6. With the cross-origin-isolated dev server, `self.crossOriginIsolated` is
   `true` in devtools and a `shared: true` system config yields a
   `SharedArrayBuffer` heap (look for "Use shared arraybuffer memory" in the
   debug log).

This has been verified end to end: both `simple.html` and `main.html` boot
OpenRISC Linux to a BusyBox shell on the minified bundles via the
cross-origin-isolated dev server (`self.crossOriginIsolated === true`), with the
zero-copy framebuffer timer running without errors.

## Deploying to a static host (Vercel)

The kernel and root filesystem live in the `openrisc-sys` / `riscv-sys`
submodules (~149 MB + ~35 MB), which the demos load lazily from
`../openrisc-sys/...`. Bundling all of that into a static deploy is impractical
(and exceeds typical limits), so `vercel.json` rewrites those asset paths to
`raw.githubusercontent.com`, pinned to the submodule commits:

```
/openrisc-sys/*  ->  raw.githubusercontent.com/s-macke/jor1k-sysroot/<commit>/*
/riscv-sys/*     ->  raw.githubusercontent.com/s-macke/riscv-sysroot/<commit>/*
```

A CDN such as jsDelivr is **not** used: the `jor1k-sysroot` repo (~149 MB)
exceeds jsDelivr's package-size limit, so it returns a ~77-byte error stub for
every file — which the emulator loads as a corrupt "kernel" and then hangs at
`Booting`. `raw.githubusercontent.com` has no repo-size limit and returns the
real files. This keeps the deploy tiny (just the demos + bundles + wasm) and,
because the rewrite is a same-origin proxy, the assets remain same-origin — so it
also works if you later add COOP/COEP headers to enable `SharedArrayBuffer`.
The relative `../openrisc-sys/...` URL resolves to `/openrisc-sys/...` whether
the Vercel root is the repo or the `demos/` folder (browsers clamp `../` at the
origin root), so no HTML changes are needed.

## Automated checks

`npm test` runs `test/cpu-facade.js`, which executes a basic instruction through
the `safe`, `asm`, and `smp` cores via the public facade and checks the result.
