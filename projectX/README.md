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

`site/index.html` is the homepage build.

- Header: the top-right link is gone; a "20 open roles" button slides in once the hero's button scrolls away.
- [x] 1. Hero: "We hire on work, not CVs." with the open-roles button, a pile of CVs that is blacked out in one quick shot, then on scroll the CVs fall while five role work scenes rise and fan out on a semicircle (design, code review, playbook, ads review, video edit). Each card pops forward on hover.
- [x] 2. What 8x is: a big text-only statement revealed word by word on scroll, then twelve square portrait photos (placeholders, img/globe) travel round "121,000 people" without touching it and pin themselves onto a globe that turns once, with "30+ countries" underneath, then "The network": two big edge-to-edge auto-scrolling rows of people photos (24 unique, img/net) that light up on demand, under "Creators post · Sales reps call · Participants talk" (photos slightly smaller), then "The core team": a 3×2 grid of big photo cards (five people, img/team plus an "Open seat · You?" card linking to the roles); the grid fades up softly when it enters view; hovering a card slides its name and role up on the photo over a progressive blur, with an orange underline under the role (always shown on touch screens), then "What 8x sells": a pinned deck of product cards (880px wide). As you scroll, each card rises from below and settles in front while the ones before it step back, smaller and blurred. Each card carries its own centred heading and a short subheading split by orange middle dots (e.g. TikTok · Instagram · YouTube); no card chrome, no pagination. Each card shows its product at work: creator phones with view counts (Social), a paid LinkedIn post (LinkedIn), an AI interview typing out (Research), a live call that books a meeting (Sales), an assignment stamped "Read by a person" (Hiring), a Reddit post with a 17-day strip (Karma), then Email and Global, locked. Photos are professional headshots from Unsplash (placeholders).
- [x] 3. The bet: a pinned, scroll-driven picture of the argument, with the four lines as small captions under it (one at a time, key word underlined). Building is cheap now: dozens of product tiles pop into existence. Getting it in front of people isn't: a crowd appears below and most tiles fall and fade, only a few survive. That takes people. 8x organises them: faces from the network pop in between and lines link the surviving tiles to them and fan out to the crowd, which lights up; orange pulses run along the lines. So here, your judgement is the product: everything dims except one tile, which rises to the centre in orange with a ring as every person links to it.
- [x] 4. What you'd own: "Join as a" big on the first line; under it, smaller, a text-height photo and the role roll over together every few seconds (Market Lead / world map, Designer / swatches, Software Engineer / code, Paid Ads Manager / dashboard, Builder in Residence / notebook; Unsplash placeholders). Hover pauses; it only plays while on screen.
- [ ] 6. How you get in
- [ ] 7. Is this for you?
- [ ] 8. Roles and apply
