import { AgentResult } from "@inngest/agent-kit";

export function getLastOutputMessage(result: AgentResult) {
    const lastMessage = result.output.at(-1)
    if (!lastMessage || lastMessage.type !== 'text') return
    return typeof lastMessage.content === 'string' ? lastMessage.content : lastMessage.content.map(c => c.text).join('\n').trim()
}