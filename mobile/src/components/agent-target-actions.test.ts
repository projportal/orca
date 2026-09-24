import { describe, expect, it, vi } from 'vitest'

vi.mock('lucide-react-native', () => ({ Copy: 'Copy', Plus: 'Plus', Send: 'Send' }))

const { buildAgentTargetActions, agentTargetLabel, agentTargetLabels } =
  await import('./agent-target-actions')

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
      ['claude (1-abcd)', true],
      ['Terminal (2)', true],
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

  it('drops the shared term_ prefix so real handles get a telling suffix', () => {
    expect(
      agentTargetLabels([
        { terminal: 'term_3f9c2a71-0b4e-4c55-9a12-6d0e8f1b2c3d', title: 'claude' },
        { terminal: 'term_b81d44e0-7a2f-4e19-8c3b-1f5a9d7e6b20', title: 'claude' }
      ])
    ).toEqual(['claude (3f9c2a)', 'claude (b81d44)'])
  })

  it('lengthens the suffix on both rows when two labels would read the same', () => {
    expect(
      agentTargetLabels([
        { terminal: 'term_abcdef11', title: 'claude' },
        { terminal: 'term_abcdef22', title: 'claude' },
        { terminal: 'term_abcdef33', title: 'codex' }
      ])
    ).toEqual(['claude (abcdef1)', 'claude (abcdef2)', 'codex (abcdef)'])
    const actions = buildAgentTargetActions({
      terminals: [
        { terminal: 'term_abcdef11', title: 'zsh' },
        { terminal: 'term_abcdef22', title: 'zsh' }
      ],
      sendDisabled: false,
      copyLabel: 'Copy',
      copyDisabled: false,
      onSendToTerminal: () => {},
      onNewSession: () => {},
      onCopy: () => {}
    })
    expect(new Set(actions.map((action) => action.label)).size).toBe(actions.length)
  })
})
