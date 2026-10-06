# e2.vc: what the style is actually doing

Read on desktop (1440×900) and on a phone (iPhone 14, 390×844), on 6 Oct 2026.
Pages: home, friends, tribe, talent, chill, team.
Screenshots: `shots/e2/`. Desktop screen recording: `video/e2-home-desktop.webm`, with contact sheets `video/sheet-e2d-*.png`.

## The one-line read

e2 says it's a fund that is really a group of friends, and every part of the style is evidence for that claim.
The motion isn't decoration added on top. It's the argument itself, made in the medium of the page.

The positioning is "we just have great taste in friends." So the page looks casual, hand-made, a bit messy and full of faces, while a strict grid underneath quietly shows that the firm is serious.

## The nine mechanisms

| # | Mechanism | How it's built | What it says |
|---|---|---|---|
| 1 | **Voice sets the register, motion matches it** | Everything lowercase and conversational ("and arin smiling 32-teeth", "pizza and beer is on us", "occasional baklava") | We're friends, not an institution. Copy and motion are in the same tone of voice |
| 2 | **Hand-drawn marks on machine type** | Rough.js ellipses, underlines and `[brackets]`, redrawn about 4 times a second so the line looks alive (a "boiling" line) | A person picked up a pen and circled the one word that matters: *friends*, *founders*, *group chat*. Used for emphasis, and shows a human was here |
| 3 | **Faces before logos** | Loader splits "e2" and "vc" apart and flashes founder photos between them. The hero is a drifting collage of headshots. Portfolio cards are founder photos, not logos. The cursor shows the name and company of whoever you're hovering | The portfolio is people. The brand is literally built around faces |
| 4 | **Mess settles into order** | Photos tilted like polaroids. "from the group chat" letters scatter and then settle into a line. A **TIDY UP** button straightens the tribe photo wall. Footer letters fall into a physics pile | Relaxed on the surface, organised underneath |
| 5 | **A visible grid** | Four full-height hairline columns run through every section and ripple when the cursor gets close | There's rigour under the play. Also holds the messy elements in place |
| 6 | **Play that rewards attention** | Drag the footer letters, hold Space to make them jump, press R to reset; footer colour cycles through 7 brights; DVD-style screensaver after 5 s idle; SF / London / Istanbul clocks with an analog face on hover; text-selection colour cycles | We care about details nobody asked for. Pure personality, no information |
| 7 | **One loud accent on a quiet base** | Cream `#fcf7f0`, ink `#1c2121`, one blue `#3451f5`. Seven brights (`#E4FC53`, `#31FE6A`, `#C294FF`, `#FF5001`, `#2D51FF`, `#FF6FFF`, `#680030`) appear only in the footer, on selection and on cards. One typeface, Inter Tight, very large, tightly spaced, lowercase | Restraint makes the blue and the brights feel like events |
| 8 | **Scroll controls the reading pace** | A shutter wipe from cream to near-black; pinned horizontal text; the colour theme scrubs from cream to navy; sentences turn from grey to ink word by word (on /talent) | One idea per screen. Each statement lands alone |
| 9 | **Receipts pinned to faces** | Every portfolio photo has two tags: company name and `RAISED $750M` / `EXIT $1.2B` / `NASDAQ: BLLN` | The proof is short, concrete and attached to a person |

How it's built: Webflow, GSAP with 7 plugins (ScrollTrigger, SplitText, DrawSVG, Draggable, Inertia, CustomEase, ScrambleText), Locomotive Scroll / Lenis, Matter.js, Rough.js and jQuery.
The homepage HTML alone is 330 KB, of which 194 KB is inline script.
Most components are credited in the source to **Osmo Supply** snippets: falling-2d-objects, shutter-scroll-transition, stacking-cards-parallax, scramble text cursor, momentum hover, line-reveal testimonials and pixel grid.
Reduced motion is respected (`prefers-reduced-motion` is checked 23 times).

## What it costs, and where it fails

- **Slow to reach content.** The loader holds the first screen for about 3 to 4 seconds before the headline is readable.
- **Very little information.** The homepage makes one point, which works for a VC whose job is a feeling plus a portfolio. A careers site has much more to explain: the work, the pace, the pay, the process.
- **Some motion means nothing.** The DVD screensaver, Space-to-jump, and the colour-split hover on images are fun, but none of them tell you anything about e2.
- **The play is desktop-only.** The keyboard tricks don't exist on a phone. On mobile the physics letters land on top of the footer links (we captured `v` covering CONTENT and `2` covering DISCLAIMER).
- **The parts are off the shelf.** Most of it is Osmo snippets. Copying them would make 8x look like e2 and like every other Osmo site, which is the "surface copy" the brief warns about.
- **Even e2's hiring page doesn't do the job we need.** /talent is a nice paragraph, a generic form and "top 4 trending jobs". It never tells anyone who *shouldn't* apply.
- **Hard to read before the scroll reaches it.** Sentences start in light grey and turn to ink only as you scroll, so the text ahead of the reveal is low contrast.

## What 8x.life takes, and what it leaves behind

**Take (the principles, not the parts):**
1. **The style has to be proof of the positioning.** e2's motion proves "friends". 8x's motion has to prove 8x's claim. From the audit, that claim is *evidence over promises*: you're judged on work, and the page should feel the same way.
2. **Faces before logos.** 8x already has short clips of 11 team members on 8x.careers, and 8x.life doesn't show one. That's the biggest asset not being used.
3. **One mark that means something.** e2 circles a word. 8x needs its own mark, tied to its own story (see the design system).
4. **One loud accent on a quiet base, and one typeface family.**
5. **Scroll controls the pace,** so each hard truth gets its own moment.
6. **Live clocks, but meaningful ones.** e2's three clocks are decoration. 8x is remote across 10 markets, so "where the team is right now, and who's awake" is real information for someone wondering when they'd work.

**Leave behind, on purpose:**
- **The loader.** A candidate should see the claim in under a second.
- **Play with no meaning:** screensaver, Space-to-jump, colour-split images, colour-cycling selection.
- **Physics as decoration.** If anything falls or collides on our page, it has to show something true about 8x.
- **The "we're all friends" voice and all-lowercase type.** 8x hires through a two-week trial and a timed assignment, so calling it "friends" would be dishonest. The 8x voice should be direct, closer to a good brief than a group chat.
- **The doodle kit.** It's e2's signature. Borrowing it would be the surface copy.
- **The weight.** About 12 third-party libraries. We use one motion library at most and CSS scroll-driven animation where it's supported.
