# Building whisper.cpp for local transcription (Linux)

The local transcription slice ships no binary. Windows has a pinned, hashed
download; Linux and macOS have no official asset in the registry
(`src/whisper-registry.js`), and the installer says so instead of guessing. On
Linux you build the same pinned tag yourself and point the plugin at it.

This page is the repeatable recipe. It is what the 1.307.34 verification run
used, and `tools/whisper-build/build-linux.mjs` is that recipe as one command.

## Prerequisites

- `git`, `cmake` and a C++ compiler (`g++` or `clang++`), plus `make`.
  Debian/Ubuntu: `sudo apt-get install -y build-essential cmake git`. Without
  root, `pip3 install --user cmake` (or a virtualenv) is enough.
- About 1 GB of free disk for the source tree and its build output.
- Network access to `github.com` for the clone (the plugin itself downloads
  nothing without your confirmation).

## The script

```sh
node tools/whisper-build/build-linux.mjs
```

It reads the pinned tag straight from `src/whisper-registry.js` (so the recipe
cannot drift from the release the installer describes), refuses to build
anywhere inside the repository, clones `--branch <tag> --depth 1`, configures a
`Release` build, builds only the `whisper-cli` target, and prints the absolute
path to paste into the plugin. Running it again reuses the checkout and the
binary; `--rebuild` forces a fresh build.

| Option | Meaning |
|---|---|
| `--tag TAG` | build another tag (warns: the registry pins one) |
| `--dir DIR` | scratch folder (default `$TMPDIR/mcq-whisper-build/<tag>`) |
| `--jobs N` | parallel compile jobs (default: CPU count) |
| `--rebuild` | build again even when the binary already exists |
| `--dry-run` | print the commands, write nothing |

## The same recipe by hand

```sh
tag=v1.8.6
git clone --depth 1 --branch "$tag" https://github.com/ggml-org/whisper.cpp.git
cmake -S whisper.cpp -B whisper.cpp/build -DCMAKE_BUILD_TYPE=Release
cmake --build whisper.cpp/build --target whisper-cli -j"$(nproc)"
./whisper.cpp/build/bin/whisper-cli --help   # prints usage, exits 0
```

## Where the binary goes

`whisper.cpp/build/bin/whisper-cli` inside the scratch folder — by default
`$TMPDIR/mcq-whisper-build/v1.8.6/whisper.cpp/build/bin/whisper-cli`, which is
outside the vault and outside the repository. Paste that absolute path into
**Settings → Read aloud → Local transcription → program path** (the
`audioTranscription.binaryPath` setting). Model files still come from
**Audio: set up local transcription…**, which downloads one model, hash-checks
it and keeps it in the plugin's own data folder.

## Nothing is added to the bundle

The binary, the source tree and the build output are never copied into the
repository, never committed and never bundled: `main.js` is built from `src/`
alone, so this recipe changes no shipped byte and no module count. The script
refuses a `--dir` inside the checkout for exactly that reason. `Audio: remove
local transcription files` deletes only the plugin's managed model files and
receipt, so a build you made here survives it.

## Verified

The 1.307.34 run on Linux built the pinned tag this way, then transcribed
`samples/jfk.wav` with the registry model through the shipped plugin — the argv,
exit code, timing and note are recorded under
[whisper-plan.md](whisper-plan.md#verified-run-130734).
