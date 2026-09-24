import { Copy, Plus, Send } from 'lucide-react-native'
import type { ActionSheetAction } from './ActionSheetModal'

type AgentTargetTerminal = { terminal: string; title: string }

/**
 * The "Send to agent" picker rows: one per agent terminal in the worktree, then New Agent Session,
 * then Copy. The review-notes sheet and the feedback composer both build their sheet from this, so
 * the two targets read and behave the same.
 */
export function buildAgentTargetActions<T extends AgentTargetTerminal>(input: {
  terminals: readonly T[]
  sendDisabled: boolean
  copyLabel: string
  copyDisabled: boolean
  onSendToTerminal: (terminal: T) => void
  onNewSession: () => void
  onCopy: () => void
}): ActionSheetAction[] {
  const labels = agentTargetLabels(input.terminals)
  return [
    ...input.terminals.map((terminal, index) => ({
      label: labels[index],
      icon: Send,
      disabled: input.sendDisabled,
      skipAutoClose: true,
      onPress: () => input.onSendToTerminal(terminal)
    })),
    {
      label: 'New Agent Session',
      icon: Plus,
      disabled: input.sendDisabled,
      skipAutoClose: true,
      onPress: input.onNewSession
    },
    {
      label: input.copyLabel,
      icon: Copy,
      disabled: input.copyDisabled,
      onPress: input.onCopy
    }
  ]
}

const SHORT_ID_LENGTH = 6

/** The terminal handle without its `term_` prefix, which every handle shares. */
function terminalIdBody(terminal: string): string {
  return terminal.replace(/^term[_-]/, '') || terminal
}

export function agentTargetLabel(terminal: AgentTargetTerminal, idLength = SHORT_ID_LENGTH) {
  return `${terminal.title || 'Terminal'} (${terminalIdBody(terminal.terminal).slice(0, idLength)})`
}

/**
 * One label per row: title plus a short terminal id. Rows whose labels would still read the same
 * get a longer id, both of them, until they differ or show the whole handle.
 */
export function agentTargetLabels(terminals: readonly AgentTargetTerminal[]): string[] {
  const labels = terminals.map((terminal) => agentTargetLabel(terminal))
  const longest = Math.max(0, ...terminals.map((t) => terminalIdBody(t.terminal).length))
  for (let length = SHORT_ID_LENGTH + 1; length <= longest; length += 1) {
    const clashing = labels.map((label) => labels.indexOf(label) !== labels.lastIndexOf(label))
    if (!clashing.includes(true)) {
      break
    }
    clashing.forEach((clash, index) => {
      if (clash) {
        labels[index] = agentTargetLabel(terminals[index], length)
      }
    })
  }
  return labels
}
