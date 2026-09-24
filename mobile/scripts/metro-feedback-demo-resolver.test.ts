import { createRequire } from 'node:module'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

/**
 * The feedback demo route carries a stand-in desktop and a ~150 KB sample frame. Only a bundle
 * built with ORCA_REVIEW_FEEDBACK_DEMO=1 may resolve it; every other bundle gets the redirect stub.
 */
const MOBILE_ROOT = join(import.meta.dirname, '..')
const CONFIG_PATH = join(MOBILE_ROOT, 'metro.config.js')
const FLAG = 'ORCA_REVIEW_FEEDBACK_DEMO'
const STUB = join(MOBILE_ROOT, 'src', 'feedback', 'demo', 'feedback-demo-disabled.tsx')
const requireConfig = createRequire(import.meta.url)
const original = process.env[FLAG]

type Resolve = (context: unknown, moduleName: string, platform: string | null) => unknown

function resolverFor(flag: string | undefined): Resolve {
  if (flag === undefined) {
    Reflect.deleteProperty(process.env, FLAG)
  } else {
    process.env[FLAG] = flag
  }
  Reflect.deleteProperty(requireConfig.cache, requireConfig.resolve(CONFIG_PATH))
  return (requireConfig(CONFIG_PATH) as { resolver: { resolveRequest: Resolve } }).resolver
    .resolveRequest
}

const context = {
  resolveRequest: (_context: unknown, moduleName: string) => ({ type: 'default', moduleName })
}

afterEach(() => {
  if (original === undefined) {
    Reflect.deleteProperty(process.env, FLAG)
  } else {
    process.env[FLAG] = original
  }
})

describe('feedback demo resolution', () => {
  it('stubs the demo entry in a normal (release) bundle', () => {
    const resolve = resolverFor(undefined)
    expect(resolve(context, '../src/feedback/demo/feedback-demo-entry', 'ios')).toEqual({
      type: 'sourceFile',
      filePath: STUB
    })
    expect(resolverFor('0')(context, '../src/feedback/demo/feedback-demo-entry', 'ios')).toEqual({
      type: 'sourceFile',
      filePath: STUB
    })
  })

  it('resolves the real demo only when the flag is 1', () => {
    expect(resolverFor('1')(context, '../src/feedback/demo/feedback-demo-entry', 'ios')).toEqual({
      type: 'default',
      moduleName: '../src/feedback/demo/feedback-demo-entry'
    })
  })

  it('leaves every other module to the default resolver', () => {
    expect(resolverFor(undefined)(context, './feedback-demo-seeds', 'ios')).toEqual({
      type: 'default',
      moduleName: './feedback-demo-seeds'
    })
  })
})
