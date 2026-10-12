# Roster On Wheels website

The ROW marketing site: nine pages, copy taken word for word from `ROW Website Content V2 Updated.docx`, in the approved "Fellowship" design (concept 03).

Built with Next.js 16 (App Router, static pages), GSAP and Lenis. Deployed on Vercel from `main`.

## Run it

```
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (all pages are static)
npm start
```

## Contact form email

The Contact Us form emails each demo request through SMTP (`app/contact-us/actions.ts`). Copy `.env.example` to
`.env.local`, or add the same names in Vercel (Settings > Environment Variables), and fill in the sending mailbox's
details. Without `SMTP_HOST` and `SMTP_PASS` the form shows its "did not go through" message.

## Where things are

| Path | What it is |
| --- | --- |
| `app/page.tsx` | Home |
| `app/<page>/page.tsx` | The eight inner pages: about-us, club-management, district-management, mobile-app, pricing, how-to-get-started, faq, contact-us |
| `app/contact-us/actions.ts` | The demo form's email sender |
| `app/layout.tsx` | Fonts, loader, header, footer |
| `app/globals.css` | Design tokens and all shared styles |
| `components/kit.tsx` | Shared page sections (hero, section, cards, steps, FAQ, stats) |
| `components/art.tsx` | Small drawing pieces and icons for the text-free pictures |
| `components/SiteHeader.tsx` | Header, full-screen menu, smooth scrolling |
| `lib/row-fx.js` | Page animations (reveals, roster wheel, sync, district hub, pictures that build in view) |
| `lib/site.ts` | Page list, contact details and the demo button link |

Every "Book a free demo" button links to the Contact Us page's demo form.
