import jestOpenApi from 'jest-openapi'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
// packages/server/src/test/ → (4 up) → project root → docs/spec/openapi.yml
jestOpenApi(resolve(__dirname, '../../../..', 'docs/spec/openapi.yml'))
