.DEFAULT_GOAL := zip
.DELETE_ON_ERROR:

PYTHON ?= python3
ARCHIVE := dist/jamingo.zip
EXTENSION_FILES := manifest.json core.js \
	background.js content.js site-audio.js native-metronome.js sync.js player-bridge.js README.md icons

.PHONY: zip FORCE

zip: $(ARCHIVE)

# Recreate the archive so removed files cannot survive from a previous build.
$(ARCHIVE): $(EXTENSION_FILES) Makefile FORCE
	mkdir -p "$(@D)"
	$(PYTHON) -m zipfile -c "$@.tmp" $(EXTENSION_FILES)
	mv "$@.tmp" "$@"
	@echo "Archive prête : $@"

FORCE:
