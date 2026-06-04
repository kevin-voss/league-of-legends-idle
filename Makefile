.PHONY: install build test start dev clean

install:
	npm install

build:
	node scripts/build.mjs

test: build
	node --test tests/*.test.mjs

start: build
	node scripts/serve.mjs

dev: start

clean:
	rm -rf dist

browser-debug: build
	node scripts/browser-debug.mjs
