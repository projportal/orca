import { describe, expect, it, vi } from 'vitest'

vi.mock('lucide-react-native', () => ({ Copy: 'Copy', Plus: 'Plus', Send: 'Send' }))

const { buildAgentTargetActions, agentTargetLabel } = await import('./agent-target-actions')

describe('agent target actions', () => {
  it('lists each terminal, then New Agent Session, then Copy, wired to their handlers', () => {
    const onSendToTerminal = vi.fn()
    const onNewSession = vi.fn()
    const onCopy = vi.fn()
    const terminals = [
      { terminal: 'term-1-abcdef', title: 'claude' },
      { terminal: 'term-2', title: '' }
    ]
    const actions = buildAgentTargetActions({
      terminals,
      sendDisabled: false,
      copyLabel: 'Copy Feedback',
      copyDisabled: false,
      onSendToTerminal,
      onNewSession,
      onCopy
    })
    expect(actions.map((action) => [action.label, action.skipAutoClose ?? false])).toEqual([
      ['claude (term-1)', true],
      ['Terminal (term-2)', true],
      ['New Agent Session', true],
      ['Copy Feedback', false]
    ])
    actions[1].onPress()
    actions[2].onPress()
    actions[3].onPress()
    expect(onSendToTerminal).toHaveBeenCalledWith(terminals[1])
    expect(onNewSession).toHaveBeenCalledOnce()
    expect(onCopy).toHaveBeenCalledOnce()
  })

  it('disables the send rows and copy independently', () => {
    const actions = buildAgentTargetActions({
      terminals: [{ terminal: 't', title: 'x' }],
      sendDisabled: true,
      copyLabel: 'Copy Notes',
      copyDisabled: false,
      onSendToTerminal: () => {},
      onNewSession: () => {},
      onCopy: () => {}
    })
    expect(actions.map((action) => action.disabled)).toEqual([true, true, false])
    expect(agentTargetLabel({ terminal: 'abcdefgh', title: 'zsh' })).toBe('zsh (abcdef)')
  })
})
