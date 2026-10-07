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

- Header: the top-right link is gone; a "See the 20 open roles" button slides in once the hero's button scrolls away.
- [x] 1. Hero: "We hire on work, not CVs." with the open-roles button, a pile of CVs that is blacked out in one quick shot, then on scroll the CVs fall while five role work scenes rise and fan out on a semicircle (design, code review, playbook, ads review, video edit). Each card pops forward on hover.
- [x] 2. What 8x is: a big text-only statement revealed word by word on scroll, then twelve square portrait photos (placeholders) travel round "121,000 people" without touching it and pin themselves onto a globe that turns once, with "30+ countries" underneath, then "The network": two big edge-to-edge auto-scrolling rows of people photos that light up on demand, under "Creators post · Sales reps call · Participants talk" (photos slightly smaller), then "The core team": a 3×2 grid of big photo cards (five people plus an empty profile card, "You?"); hovering a card brings its name and role up on the photo over a progressive blur, with an orange underline under the role (always shown on touch screens), then the products.
- [ ] 3. The bet
- [ ] 4. What you'd own
- [ ] 5. Who you'd work with
- [ ] 6. How you get in
- [ ] 7. Is this for you?
- [ ] 8. Roles and apply
