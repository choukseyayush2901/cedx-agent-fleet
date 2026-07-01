.PHONY: install demo verify trace eval replay probe-approval probe-agent-failure probe-budget probe-append-only probe-idempotency probe-crash build prisma-push clean

install:
	npm install

build:
	npm run build

prisma-push:
	npm run prisma:push

demo:
	npm run prisma:push
	npx tsx src/index.ts demo

verify:
	python3 verify_audit.py --audit out/audit.json --transcripts transcripts --schema audit.schema.json

trace:
	npx tsx src/index.ts trace ID=$(ID)

eval:
	npx tsx src/index.ts eval

replay:
	npx tsx src/index.ts replay ID=$(ID)

probe-approval:
	npx tsx src/index.ts probe-approval

probe-agent-failure:
	npx tsx src/index.ts probe-agent-failure

probe-budget:
	npx tsx src/index.ts probe-budget

probe-append-only:
	npx tsx src/index.ts probe-append-only

probe-idempotency:
	npx tsx src/index.ts probe-idempotency

probe-crash:
	npx tsx src/index.ts probe-idempotency

clean:
	rm -rf dist out/*.json
