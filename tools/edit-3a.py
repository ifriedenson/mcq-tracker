import re

P = "src/plugin.js"
t = open(P).read()

# 1. checkOptions gains deleteSession so every check cleans up its OpenCode session.
old = "    const checkOptions = { shouldStop, onNotice };"
assert t.count(old) == 1
t = t.replace(old, "    const checkOptions = { shouldStop, onNotice, deleteSession: true };")

# 2. ask() threads the cleanup flag into both aiComplete calls.
old = '{ feature: "verification", maxTokens: 800, model }'
assert t.count(old) == 2, t.count(old)
t = t.replace(old, '{ feature: "verification", maxTokens: 800, model, deleteSession: o.deleteSession === true }')

# 3. Consensus votes clean up their sessions too.
old = "const again = await this.verifyQuestionDraft(item, { model, noRetry: true, shouldStop: o.shouldStop, onNotice: o.onNotice });"
assert t.count(old) == 1
t = t.replace(
    old,
    "const again = await this.verifyQuestionDraft(item, { model, noRetry: true, shouldStop: o.shouldStop, onNotice: o.onNotice, deleteSession: o.deleteSession === true });",
)

# 4. Run the items through a small bounded pool instead of one at a time.
start_marker = "    let position = 0;\n    for (const item of list) {"
start = t.find(start_marker)
assert start >= 0
brace = 0
i = start + len("    let position = 0;\n")
body_start = None
for j in range(i, len(t)):
    ch = t[j]
    if ch == "{":
        if brace == 0:
            body_start = j + 1
        brace += 1
    elif ch == "}":
        brace -= 1
        if brace == 0:
            body_end = j
            break
body = t[body_start:body_end]
lines = body.split("\n")
# Drop the sequential preamble: stop break, non-object skip, position counter.
assert lines[1].strip() == "if (shouldStop && shouldStop()) break;", lines[1]
assert lines[2].strip() == 'if (!item || typeof item !== "object") continue;', lines[2]
assert lines[3].strip() == "position++;", lines[3]
assert lines[4].strip() == "if (onProgress) onProgress(position, list.length);", lines[4]
rest = lines[5:]
# Re-indent the body two spaces deeper for the worker function.
indented = [(("  " + line) if line.strip() else line) for line in rest]
pool = """    const slots = Math.max(1, Math.min(4, Math.floor(Number(o.concurrency) > 0 ? Number(o.concurrency) : 1)));
    let nextIndex = 0;
    let completed = 0;
    const checkOne = async () => {
      for (;;) {
        if (shouldStop && shouldStop()) return;
        const index = nextIndex++;
        if (index >= list.length) return;
        const item = list[index];
        if (!item || typeof item !== "object") {
          completed++;
          if (onProgress) onProgress(completed, list.length);
          continue;
        }
""" + "\n".join(indented) + """
        completed++;
        if (onProgress) onProgress(completed, list.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(slots, Math.max(list.length, 1)) }, () => checkOne()));"""
end = body_end + 1
# Skip the loop's closing newline handling: replace through the closing brace.
t = t[:start] + pool + t[end:]

# 5. aiChat cleans up the OpenCode session behind a check when asked.
old = """        const last = [...turns].reverse().find((turn) => turn.role === "assistant");
        const text = last ? last.texts.join("\\n").trim() : "";
        if (!text) throw new Error("OpenCode returned an empty reply.");
        return text;"""
assert t.count(old) == 1
t = t.replace(
    old,
    """        const last = [...turns].reverse().find((turn) => turn.role === "assistant");
        const text = last ? last.texts.join("\\n").trim() : "";
        if (!text) throw new Error("OpenCode returned an empty reply.");
        if (o.deleteSession === true && typeof oc.deleteSession === "function") {
          try {
            await oc.deleteSession(session.id);
          } catch (cleanupError) {
            /* the session already ended or the server never tracked it */
          }
        }
        return text;""",
)

open(P, "w").write(t)
print("plugin.js pool + cleanup wired")
