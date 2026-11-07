.DEFAULT_GOAL := zip
.DELETE_ON_ERROR:

PYTHON ?= python3
ARCHIVE := dist/jamingo.zip
EXTENSION_FILES := manifest.json core.js \
	background.js content.js site-audio.js native-metronome.js sync.js player-bridge.js README.md LICENSE icons docs/publishing.md

.PHONY: zip FORCE

zip: $(ARCHIVE)

# Recreate the archive so removed files cannot survive from a previous build.
$(ARCHIVE): $(EXTENSION_FILES) Makefile FORCE
	$(PYTHON) scripts/check-package.py
	mkdir -p "$(@D)"
	$(PYTHON) scripts/build-package.py "$@.tmp" $(EXTENSION_FILES)
	mv "$@.tmp" "$@"
	$(PYTHON) scripts/check-package.py --archive "$@" --checksum "$(@D)/SHA256SUMS"
	@echo "Archive prête : $@"

FORCE:
