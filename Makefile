.DEFAULT_GOAL := zip
.DELETE_ON_ERROR:

PYTHON ?= python3
ARCHIVE := dist/riff-reel.zip
EXTENSION_FILES := riff-reel/manifest.json riff-reel/core.js \
	riff-reel/background.js riff-reel/content.js riff-reel/site-audio.js riff-reel/native-metronome.js riff-reel/sync.js riff-reel/player-bridge.js riff-reel/README.md

.PHONY: zip FORCE

zip: $(ARCHIVE)

# Recreate the archive so removed files cannot survive from a previous build.
$(ARCHIVE): $(EXTENSION_FILES) Makefile FORCE
	mkdir -p "$(@D)"
	$(PYTHON) -m zipfile -c "$@.tmp" $(EXTENSION_FILES)
	mv "$@.tmp" "$@"
	@echo "Archive prête : $@"

FORCE:
