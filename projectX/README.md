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

## Phase 2: the homepage, section by section (in progress)

Spacing runs on an 8px grid: 8 / 16 / 24 / 32 inside a section, and one section gap (96px on phones, 128px from 900px up) between sections, including around the pinned scenes (worked out from their real layout). Text is never smaller than 12px, apart from the miniature mock screens inside the hero illustration.

`site/index.html` is the homepage build.

- Header: the top-right link is gone; a "20 open roles" button slides in once the hero's button scrolls away.
- [x] 1. Hero: "We hire on work, not CVs." with the open-roles button, a pile of CVs that is blacked out in one quick shot, then on scroll the CVs fall while five role work scenes rise and fan out on a semicircle (design, code review, playbook, ads review, video edit). Each card pops forward on hover.
- [x] 2. What 8x is: a big text-only statement revealed word by word on scroll, then twelve square portrait photos (placeholders, img/globe) travel round "121,000 people" without touching it and pin themselves onto a globe that turns once, with "30+ countries" underneath, then "The network": two big edge-to-edge auto-scrolling rows of people photos (24 unique, img/net) that light up on demand, under "Creators post · Sales reps call · Participants talk" (photos slightly smaller), then "The core team": a 3×2 grid of big photo cards (five people, img/team plus an "Open seat · You?" card linking to the roles); the grid fades up softly when it enters view; hovering a card slides its name and role up on the photo over a progressive blur, with an orange underline under the role (always shown on touch screens), then "What 8x sells": a pinned deck of product cards (880px wide). As you scroll, each card rises from below and settles in front while the ones before it step back, smaller and blurred. Each card carries its own centred heading and a short subheading split by orange middle dots (e.g. TikTok · Instagram · YouTube); no card chrome, no pagination. Each card shows its product at work: creator phones with view counts (Social), a paid LinkedIn post (LinkedIn), an AI interview typing out (Research), a live call that books a meeting (Sales), an assignment stamped "Read by a person" (Hiring), a Reddit post with a 17-day strip (Karma), then Email and Global, locked. Photos are professional headshots from Unsplash (placeholders).
- [x] 3. The bet: four centred lines shown together ("Building is cheap now." / "Getting it in front of people isn't." / "That takes people. 8x organises them." / "So here, your judgement is the product."), revealed word by word as they scroll into view, with the key words underlined in orange once they light up (cheap, in front of people, organises, judgement). No pinning; it sits close under the product cards.
- [x] 4. Join as: a large photo card (16:9, 4:5 on phones) with no label. The photo crossfades with a slow push-in and "Join as a" (small) over the role (big, rolling over) sits on it in white: Market Lead (city skyline), Designer (wireframe sketching), Software Engineer (developers at screens), Paid Ads Manager (laptop dashboard), Builder in Residence (sticky-note session). Unsplash placeholders. The role size is fitted so the longest always fits. Hover pauses; it only plays while on screen. On scroll the section pins: it settles on Market Lead, the big card narrows into a portrait card in the centre while "Join as a" lifts off the photo (white fading to ink) and docks above the row, written once; the cards carry only their role names; the other four role cards slide in beside it once it has shrunk, then the row glides sideways with the scroll, one card at a time into the centre (centred card slightly larger and brighter, neighbours peeking at the edges).
- [x] 5. How you get in: pinned; one big line per step crossfades in the middle with a one-line subline (You apply. No CV. / The assignment arrives. / A person reads it. / Two weeks on the real work. / Then you both decide.). Under it, a fourteen-day ruler with quarter-day ticks: an orange playhead glides along with the scroll carrying the current stage label (Day 0, Minute one, Within days, Two-week trial, Day 14), passed ticks and stage markers light up, and the two-week trial span fills in orange.
- [x] 6. Is this for you?: six honest statements on a stack of cards, answered one at a time with "That's me" or "Not really"; each card flies off to the side and the next comes forward. The last card gives an honest verdict (fit right in / some of this will stretch you / probably not for you, and that's fine) with a link to the roles and "Start again". Works without motion too. The next questions sit stacked under the front card, smaller and blurred. The cards carry no small captions. The verdict ends with only "Start again", 24px below the card; the one primary call to action is the apply button below, and the header button steps aside while it is on screen.
- [x] 7. The close: "Show us the work." and the apply button, then a simple footer (wordmark, "Remote-first, built from San Francisco.", Manifesto / 8x.careers / LinkedIn). The roles list was removed.

## Deploying on Vercel

The homepage is a static site (`projectX/site/index.html` plus `img/`), with no build step. `vercel.json` at the repo root points Vercel at `projectX/site`, caches images for a year and adds two basic security headers.

1. On vercel.com, choose **Add New → Project** and import `jamiecodestoo/claudecodes`.
2. Leave **Framework Preset** on **Other** and **Root Directory** on the repo root; `vercel.json` sets the output folder.
3. Deploy. Pushes to the production branch redeploy automatically, and other branches (such as `claude/lucid-rubin-4cv0gf`) get preview URLs.

From a terminal instead: `npx vercel` in the repo root, then `npx vercel --prod`.
