import { Text } from 'ink'
import { useStore } from '../core/store'

export function HelpLine() {
  const mode = useStore(state => state.mode)
  return <Text color="#565f89">{mode === 'input'
    ? 'enter send(valid JSON) · up/down history · tab/esc view · ctrl+r restart · ctrl+s export · ctrl+l clear · ctrl+c quit'
    : 'j/k scroll · ctrl+d/u half page · g/G top/bottom · e expand · f stderr · tab input · ctrl+c quit'}</Text>
}
