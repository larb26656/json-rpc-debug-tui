import { Box, Text, useInput } from "ink";
import { useStore } from "../core/store";
import { parseJsonSafe, strWidth } from "../ui/json";

function CursorLine({ line, col, width }: { line: string; col: number; width: number }) {
  const chars = [...line];
  let start = 0;
  while (start < col && strWidth(chars.slice(start, col).join("")) >= width) start++;
  return (
    <Text>
      {chars.slice(start, col).join("")}
      <Text inverse bold>
        {chars[col] ?? " "}
      </Text>
      {chars.slice(col + 1).join("")}
    </Text>
  );
}

export function InputBox({
  onSend, maxHeight, width,
}: {
  onSend: (text: string) => void;
  maxHeight: number;
  width: number;
}) {
  const mode = useStore((state) => state.mode);
  const lines = useStore((state) => state.lines);
  const cursor = useStore((state) => state.cursor);
  const history = useStore((state) => state.history);
  const histIdx = useStore((state) => state.histIdx);

  useInput((input, key) => {
    const state = useStore.getState();
    if (state.mode !== "input") return;
    if (key.tab || input === "\t") return;
    if (key.return || input === "\r") {
      const text = state.lines.join("\n");
      if (text.trim() && parseJsonSafe(text).ok) onSend(text);
      else state.breakLine();
      return;
    }
    if (key.upArrow) {
      if (state.cursor.row === 0) state.historyPrev();
      else state.moveV(-1);
      return;
    }
    if (key.downArrow) {
      if (state.cursor.row === state.lines.length - 1) state.historyNext();
      else state.moveV(1);
      return;
    }
    if (key.leftArrow) return state.moveH(-1);
    if (key.rightArrow) return state.moveH(1);
    if (key.home) return state.moveHome();
    if (key.end) return state.moveEnd();
    if (key.backspace) return state.backspace();
    if (key.delete) return state.backspace();
    if (key.ctrl) {
      if (input === "a") state.moveHome();
      else if (input === "e") state.moveEnd();
      else if (input === "w") state.deleteWordBack();
      return;
    }
    if (input && !key.meta) state.insertText(input);
  });

  const text = lines.join("\n");
  const valid = Boolean(text.trim()) && parseJsonSafe(text).ok;
  const rowCount = Math.max(1, Math.min(12, maxHeight - 4 - (!text ? 1 : 0)));
  const first = Math.max(0, Math.min(cursor.row, lines.length - rowCount, cursor.row - rowCount + 1));
  const shown = lines.slice(first, first + rowCount);

  return (
    <Box
      borderStyle="round"
      borderColor={mode === "input" ? "#7aa2f7" : "#565f89"}
      flexDirection="column"
      paddingX={1}
      flexShrink={0}
      overflow="hidden"
    >
      {first > 0 && <Text color="#565f89" wrap="truncate-end"> ... {first} lines above</Text>}
      {shown.map((line, index) => {
        const row = first + index;
        return (
          <Text key={row} wrap="truncate-end">
            {row === cursor.row ? (
              <CursorLine line={line} col={cursor.col} width={width - 4} />
            ) : (
              line
            )}
          </Text>
        );
      })}
      {!text && (
        <Text color="#565f89" wrap="truncate-end">
          {" "}
          type JSON, for example:{" "}
          {'{"jsonrpc":"2.0","id":1,"method":"initialize"}'}
        </Text>
      )}
      <Box height={1} overflow="hidden" justifyContent="space-between">
        <Text wrap="truncate-end" color={valid ? "#9ece6a" : "#565f89"}>
          {valid
            ? "✓ valid JSON - enter to send"
            : "· incomplete JSON - enter for newline"}
        </Text>
        <Text wrap="truncate-end" color="#565f89">
          {histIdx === null
            ? "tab: view"
            : `history ${histIdx + 1}/${history.length}`}
        </Text>
      </Box>
    </Box>
  );
}
