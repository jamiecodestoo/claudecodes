# Interaction and motion research

## The rule

e2's motion works because it proves e2's claim ("friends"). Ours has to prove 8x's claim (evidence).

So every interaction has to do at least one of three jobs, or it doesn't ship:

- **Reveal:** brings up a fact that's currently buried.
- **Prove:** attaches evidence to a claim.
- **Sort:** helps the visitor decide whether this place is for them.

Anything that only looks impressive fails this test. That rules out loaders, cursor trails, screensavers and physics for its own sake.

## What the research says

- **Realistic job previews work.** A meta-analysis of 40 studies found that showing candidates the hard parts of a job lowers drop-out during hiring and early turnover, and raises performance. The two mechanisms are *self-selection* and *met expectations*. ([Phillips 1998, via PSU](https://pure.psu.edu/en/publications/effects-of-realistic-job-previews-on-multiple-organizational-outc/), [summary](https://glider.ai/?p=47510))
  → This is the evidence behind the brief's "give the wrong people a reason to self-select out". The hard parts are a feature.
- **PostHog's lessons from hiring:** "Tell people who the role is not for – it increases enthusiasm with the right people." "Most cool companies have amazingly boring job ads. It is very easy to differentiate yourself by being mildly interesting." "Sharing the salary up front is a great way to screen out expensive people early." ([PostHog](https://posthog.com/newsletter/43-lessons-about-hiring-for-startups))
- **Saying it plainly is now a recognised pattern.** Gumroad: "If you hate meetings and love to ship… this may be a good fit." Anduril ran billboards saying "Don't work here". ([Boston Globe](https://www.bostonglobe.com/2025/03/04/business/anduril-recruiting-ads-dont-work-here))
  The pattern only works when the claims are specific and true. A vague "we're not for everyone" is just another cliché.
- **The platform has caught up.** CSS scroll-driven animation (`animation-timeline: view()`) is supported in Chrome and Edge 115+ and Safari 26+, but not yet in Firefox. So we can use it as a lightweight progressive enhancement and fall back to a small GSAP ScrollTrigger script where needed. ([Chrome for Developers](https://developer.chrome.com/blog/scroll-triggered-animations), [overview](https://www.buildmvpfast.com/blog/css-scroll-driven-animations-replace-js-2026))

## Candidate concepts

Each concept is tied to the candidate question it answers (from the audit, §7), its job (Reveal / Prove / Sort) and an honest cost.
Cost: S = CSS plus a little JS; M = a custom script; L = canvas or WebGL, or heavy state.

### A. The redline: generic edited into specific *(signature, recommended)*
The page literally edits generic careers copy into 8x's real, specific copy. A typeset strike draws across the cliché and the 8x sentence settles in beneath it in the accent colour.
> ~~We're a fast-paced, dynamic team.~~ → **Small budgets on purpose. Find what works before anyone spends real money.**
> ~~Competitive internship programme.~~ → **Interns get a country. Write the playbook, close the first clients.**

- **Answers:** "Is this different?" (Q5) and "What would I own?" (Q1)
- **Job:** Reveal and Sort. It shows the analysis in the design. And anyone who *wanted* the generic version has just been given a reason to leave.
- **Why it's ours, not e2's:** e2's mark is a doodle of affection. Ours is an editor's correction: precise, typeset, never hand-drawn. It's the gesture of someone *reading your work*, which is exactly what 8x promises applicants.
- **Motion:** the strike draws across in 400 ms on entering the viewport, then the replacement rises line by line. With reduced motion, both are shown at once, struck through.
- **Cost:** S

### B. Claim → receipt *(content system, recommended)*
Every claim is a short, large sentence. Each has a receipt: a quote from a real listing, a number, or a team clip. It's shown attached to the claim like a reviewer's margin note. On desktop the receipt slides out on hover or focus; on mobile it's shown inline under the claim.

- **Answers:** all of them. This is the page's grammar.
- **Job:** Prove
- **Cost:** S

### C. The fit check *(the sorting moment, recommended)*
Six honest either/or pairs, taken from the opt-in / opt-out table:
> "I want a manager to tell me what's next" ←→ "Hand me a country and a deadline"

You tap or drag a slider toward one side of each pair. At the end you get a straight answer: "You'd probably hate it here. Here's why, and that's fine," or "Here are the roles that fit you." It never collects data or sends anything.

- **Answers:** "Is this for me?" (Q6)
- **Job:** Sort. This is the brief's self-selection job, done literally.
- **Accessibility:** each pair is a native radio group. Dragging is an extra, never the only way.
- **Cost:** M

### D. The trial clock *(process as an experience, recommended)*
A scroll-pinned timeline of the way in: **Apply → the assignment arrives that second (a timer starts) → you send work → a person reads it → two-week trial → decision.** The timer visibly runs past zero and *nothing locks*, which acts out the real rule "tracked, never enforced".

- **Answers:** "How do I get in?" (Q7)
- **Job:** Reveal and Prove
- **Cost:** M

### E. Faces with receipts *(people, recommended)*
The 11 existing team clips from 8x.careers. On desktop a clip plays muted on hover; on mobile it plays on tap. Each face carries the receipt of what that person owns, the same way e2 tags each founder with "RAISED $750M".

- **Answers:** "Who would I work with?" (Q4)
- **Job:** Prove
- **Note:** this needs the clips and, for each person, one line on what they own. Placeholders until 8x supplies them.
- **Cost:** S to M

### F. Unlock the next one *(turns the product list into an invitation, recommended)*
Today's product list ends with two greyed-out lines: "8x Email · not unlocked yet" and "8x Global · not unlocked yet". Those locked slots are the most interesting thing on the page. We keep the system list, but on hover or tap the locked rows show who unlocks them: *"Somebody at 8x will build this. The Intrapreneur role exists for it: lead a project from research to revenue."*

- **Answers:** "What would I own?" (Q1)
- **Job:** Reveal and Sort
- **Cost:** S

### G. Who's awake *(remote reality, optional)*
e2 shows three city clocks as decoration. Ours shows where 8x actually works: SF plus the ten markets, each with its live local time and a daylight band. It answers a question a remote candidate really has: when would I overlap with people?

- **Answers:** "What's the pace and the deal?" (Q3)
- **Job:** Reveal
- **Needs:** 8x to confirm where people actually sit.
- **Cost:** S

### H. The manifesto as a proof *(belief, recommended)*
The six lines are really an argument: cheap building → distribution matters → jobs change → human judgement is the bottleneck → 8x organises it. We set it as a chain that locks together on scroll, each line joined by "so". It ends on the line the current site leaves out: *"So at 8x, your judgement is the product. Show us."*

- **Answers:** "What do they believe?" (Q5)
- **Job:** Prove (the argument), then Sort (it asks something of the reader)
- **Cost:** S

### I. 250k, resolved to one person *(scale, maybe)*
A dense field of dots stands for 250k+ people. Scrolling zooms into one dot until it becomes a face and a name.
It turns "humans managed" from inventory into people. But it's the costliest idea here and the closest to a cliché (the network globe). **Only build it if the homepage has time and performance budget left over.**

- **Job:** Reveal
- **Cost:** L

## Rejected, and why

| Idea | Why not |
|---|---|
| Intro loader (as on e2) | Delays the claim. Candidates should see it in under a second |
| Custom cursor or cursor label | Desktop-only, adds nothing on a phone, where a big share of candidates will read this |
| Physics, screensaver, Space-to-jump | Personality without information. Fails the reveal / prove / sort test |
| Smooth-scroll hijacking (Locomotive, Lenis) | Fights native scrolling, hurts accessibility, adds weight. Native scroll plus scroll-linked effects is enough |
| Hand-drawn doodles | e2's signature. Copying it would be a surface copy |
| 3D or WebGL hero | Expensive. Says "tech company", not "human company" |

## Motion principles (they feed the design system)

1. **Motion only means three things:** reveal (something appears), prove (evidence attaches), or sort (you choose). Nothing moves without one of those reasons.
2. **One idea per screen at the key moments.** Pin a section only where the reader needs to stop and decide.
3. **Fast in, never slow.** 200 to 450 ms for small elements, 600 to 900 ms for a section-level reveal. No motion waits for the user.
4. **Scroll-linked rather than time-locked,** so the reader controls the pace.
5. **Reduced motion is a full experience, not a degraded one.** Every state that motion reveals is readable without the motion.
6. **Touch first.** Every hover has a tap or always-visible equivalent on mobile.
7. **Budget:** under 60 KB of JavaScript in total, gzipped. One library at most (GSAP core plus ScrollTrigger is about 45 KB gzipped), with CSS scroll-driven animation preferred where supported.
