# projectX: 8x.life redesign

A design challenge to redesign [8x.life](https://8x.life/), 8x's life-at-8x site, using [e2.vc](https://e2.vc/) as the style reference.

**Brief:** make the right people want to work at 8x, and give the wrong people a reason to opt out.

## Phase 1: research and design system (done)

| File | What it is |
|---|---|
| `research/01-8x-audit.md` | What 8x.life says today: what's vague, buried, generic, missing or contradictory; the beliefs to aim for; who should opt in and who should opt out |
| `research/02-e2-teardown.md` | What e2.vc's style is actually doing, what it costs, and what we take and leave behind |
| `research/03-interactions.md` | Interaction and motion concepts, each tied to a candidate's question |
| `research/raw/context/findings.md` | Outside context on 8x, with sources |
| `research/shots/` | Screenshots of 8x.life, 8x.careers and e2.vc, desktop (1440×900) and phone (390×844) |
| `research/video/` | Screen recording of e2.vc in motion, plus contact sheets |
| `groundwork/index.html` | The review page: audit, teardown, concepts and the live design system |

## Phase 2: the homepage, a "life at 8x" page (built)

`site/index.html` is the homepage. It is a life-at-8x page, not a job board: open roles live on 8x.careers and get one quiet line at the end.

Spacing runs on an 8px grid: 8 / 16 / 24 / 32 inside a section, and one section gap (96px on phones, 128px from 900px up) between sections, including around the pinned scenes (worked out from their real layout). Text is never smaller than 12px. The header holds the wordmark and a quiet "Careers" link.

1. **Hero:** "Life at 8x" / "Seven people. Five time zones. One very big job." Under it, a large dotted globe turns slowly. The core team is pinned where they live (San Francisco, Ljubljana, Istanbul, Lahore, Bengaluru), each with their live local time; orange arcs hand work from one place to another; and a dashed "You" pin sits in the visitor's own time zone. Labels stack when they would collide. With reduced motion it is a still globe.
2. **What 8x is:** the big statement, revealed word by word.
3. **The network:** two edge-to-edge rows of people that light up on demand.
4. **What 8x sells:** the pinned deck of product cards.
5. **The bet:** four lines revealed word by word, key words underlined.
6. **A week at 8x:** pinned; a week calendar fills in day by day while one line per day crossfades above it (You decide what ships this week / Your hours, your city, your time zone / Feedback is written, so it crosses time zones / Small budgets. Test fast, kill what does not work / Show the work. The numbers decide). On phones it shows one day at a time.
7. **The core team:** the 3 x 2 grid with hover details; the last card is the open seat.
8. **From the work:** a dark rounded panel, "From the people / who do the work." Story cards flow through it as you scroll, zigzagging from one lower side to the opposite upper side and tilting in perspective off-centre (after the "From the first people to use it" section on wisprflow.ai). Photo cards carry a quote, a name and a big number (17 days, 1 country, 0 interviews, 15 to 50+); quote cards carry the founders' public lines.
9. **Is this for you?:** six honest statements on a blurred stack, answered one at a time, with an honest verdict.
10. **Close:** "Open roles live on 8x.careers." and the footer.

**Placeholders to confirm with 8x:** team names, photos and cities; the story quotes and numbers (built from public facts: Karma in 17 days, interns launching markets, hired on a hackathon, 15 to 50+ accounts); the calendar entries; 121,000 people and 30+ countries.

## Deploying on Vercel

The homepage is a static site (`projectX/site/index.html` plus `img/`), with no build step. `vercel.json` at the repo root points Vercel at `projectX/site`, caches images for a year and adds two basic security headers.

1. On vercel.com, choose **Add New → Project** and import `jamiecodestoo/claudecodes`.
2. Leave **Framework Preset** on **Other** and **Root Directory** on the repo root; `vercel.json` sets the output folder.
3. Deploy. Pushes to the production branch redeploy automatically, and other branches (such as `claude/lucid-rubin-4cv0gf`) get preview URLs.

From a terminal instead: `npx vercel` in the repo root, then `npx vercel --prod`.
