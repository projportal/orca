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
  return [
    ...input.terminals.map((terminal) => ({
      label: agentTargetLabel(terminal),
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

export function agentTargetLabel(terminal: AgentTargetTerminal): string {
  return `${terminal.title || 'Terminal'} (${terminal.terminal.slice(0, 6)})`
}
