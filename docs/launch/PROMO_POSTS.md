# Launch Posts for International Platforms

Use these templates to launch your project on Hacker News and Reddit. They are written to highlight the core philosophy of "Personal Context Engine" and the pain point of LLM lock-in.

---

## 1. Hacker News (Show HN)

**Title:** Show HN: Personal Context Engine – Own your context across all LLMs

**Body / First Comment:**

Hi HN,

I built the Personal Context Engine because I was tired of rewriting my background every time I switched between ChatGPT, Claude, and Cursor. Every major platform now has a "memory" feature, but our context is trapped inside each one. 

Worse, most LLMs don't truly *know* you even with memory. They store what you *tell* them, which is often a filtered, rationalized version of yourself. The gap between "what you say about yourself" (e.g., "value: freedom") and "how you actually behave" is where the real signal lives.

So I built a local-first engine that builds your context from the outside in:
1. **Passive Interview:** It acts as an interviewer, asking behavior-based questions (e.g., "Where did your time and money go this week?" or "What made your body feel light?").
2. **Vignette Extraction:** Instead of extracting generic labels, the local LLM extracts specific scenes (vignettes). 
3. **Portable Markdown:** It exports your entire identity into plain Markdown files layered by depth (Core, Shape, State).

You can paste these Markdown files into any system prompt or use the included **MCP (Model Context Protocol) Server** to connect it directly to Claude Desktop, Cursor, or any supported AI tool.

No cloud lock-in, just plain text. I'd love to hear your thoughts on this approach to personal data portability and AI memory!

Repo: https://github.com/uchidayuma/personal_context
Live Demo: https://personal-context.onrender.com/ (No install required)

---

## 2. Reddit: r/LocalLLaMA

**Title:** I got tired of LLM memory lock-in, so I built a local engine that interviews you and exports your "Context" as Markdown (and an MCP Server)

**Body:**

Hey everyone,

I wanted to share an open-source project I’ve been working on called **Personal Context Engine**.

I realized that while ChatGPT and Claude have great memory features now, that memory isn't portable. You can't take your Claude context into Cursor. 

Also, I strongly believe that how you *felt* reveals more truth than how you *thought*. Traditional AI memory just stores facts we declare about ourselves. This engine takes a different approach:
- It interviews you passively, asking about actions and physical sensations rather than abstract thoughts.
- It extracts "Vignettes" (specific behavioral scenes) instead of just bullet points. A single sentence like *"Turned down a promotion because the Monday all-hands felt wrong"* gives a local model way more signal than just *"values: freedom"*.
- **It's fully local-first.** It runs on Docker (Node.js/SQLite) and supports Ollama out of the box (as well as OpenAI/Anthropic via API).
- It exports everything as plain `.md` files.
- It includes an **MCP server**, so you can hook your context directly into Claude Desktop or Cursor seamlessly.

It's entirely open-source (MIT). I'd love for this community to try it out, especially the Ollama integration, and let me know if this approach to "Portable AI Memory" makes sense to you.

GitHub: https://github.com/uchidayuma/personal_context

---

## 3. Reddit: r/ClaudeAI & r/Cursor

**Title:** How I bring my exact personal context into Claude/Cursor without rewriting it every time (Open Source MCP Server)

**Body:**

Hi all,

If you use multiple AI tools (Claude Desktop, Cursor, etc.), you know the pain of having your "Project Knowledge" or "Memory" fragmented across platforms. 

I built an open-source tool called **Personal Context Engine**. It’s a local app that occasionally interviews you to figure out what you are working on, what your core values are, and how you make decisions.

But the best part for this community: **It has a built-in MCP (Model Context Protocol) server.** 

Once the engine learns about you, you can just add it to your `claude_desktop_config.json` or Cursor settings. The AI can now dynamically read your "Core" context (who you are) and your "State" context (what you are currently focusing on) directly from your local SQLite database, exported as clean Markdown.

It stops the AI from giving generic, "safe" answers because it actually knows your specific behavioral patterns and current goals.

Check it out if you're interested in owning your context:
https://github.com/uchidayuma/personal_context
