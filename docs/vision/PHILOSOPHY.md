# Personal Context Engine: Design Philosophy

<!-- English translation of PHILOSOPHY.ja.md — update both files together -->

## **How you felt** is closer to the truth than **how you thought**

I built this system because I spent a long time ignoring my body's signals.

That is why this system insists on behavior-based questions.

**How you thought** is already a processed version of yourself. It is the answer filtered through social norms, others' expectations, and the "should" imposed from outside. Words that come from the head speak not from your true self, but from your **edited self**.

**How you felt** is different. The body does not lie.

Did your body feel light in that moment, or heavy? Did you lose track of time, or could you not get out of bed the next morning? Did anger rise, or did a quiet joy come over you? These **body-based facts** know the truth before the mind starts rationalizing.

---

## Connecting to System Design

That is why this system never asks "What are your values?"

Instead, it asks about the moments your body moved — or stopped. Where your money and time actually went. The specific scenes where someone else's behavior felt wrong.

First: train yourself to notice your body's signals in daily life.

For me, it is the expansion in my chest, the lightness in my shoulders and legs, the state of my stomach. But this is personal — your barometer will differ.

What the interview draws out is not a **verbalized self-image**, but **traces of behavior and emotion**.

This is the same reason vignettes become the most critical input for an LLM.

A single sentence — "that moment when my body felt light" — tells an LLM more about a person than ten bullet points of values.

Emotion knows the truth before thought does.

---

## What a Vignette Is, and Why It Matters Most

When you give an LLM the words "value: freedom," the LLM imagines **freedom in general**.

Not your freedom — but the statistical average of "freedom" across everything humanity has ever written. That average is far from you.

A vignette is different. It is a **specific scene**.

*"Turned down a promotion. When asked why, said 'the Monday all-hands just felt wrong.'"*

From that one sentence, an LLM grasps the shape of your "freedom": what situations trigger that feeling, how you express it in words, the fact that you decide with your body rather than your head.

A label is **compressed information**. Compression strips out personal context. A vignette is pre-compression — place, time, conversation, body sensation still intact.

In fiction terms: "She was sad" versus "She put down the phone and stared at the wall for three minutes." The first is explanation; the second is scene. An LLM reads people through scenes.

**What makes a vignette:**

- A specific situation (when, where, what happened)
- A physical reaction or behavioral fact — not an emotional label
- Distinctiveness: something unmistakably *this person*

"I felt happy when I helped a friend" is not a vignette.
"I stopped everything I was doing to spend two hours with a junior colleague who reached out the day before a deadline. The next day's work all slipped. I had no regrets." — that is a vignette.

---

## Why the System Prioritizes Vignettes

The instruction to the extraction AI is not "summarize the facts" — it is "**preserve the scenes**."

Summarization kills context. Scenes keep it alive.

The system's output file (`life_chapters.md`) is a collection of vignettes. An LLM reading it does not learn facts about you — it **raises its resolution of you as a person**.

An LLM with higher resolution can judge: "This person would probably feel this way," "This option doesn't fit who they are." That is what "sharper AI responses" actually means.
