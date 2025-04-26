#! /bin/bash
set -e

npx wrangler vectorize create contextual-rag-index --dimensions=1024 --metric=cosine
npx wrangler vectorize create-metadata-index contextual-rag-index --property-name=timestamp --type=number

npx wrangler d1 create contextual-rag
