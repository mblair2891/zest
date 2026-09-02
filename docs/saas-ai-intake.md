# AI-assisted Stage A intake

Stage A (`/get-pricing`) now starts with an interview, then the structured form, then the quote snapshot.

## Flow

1. Optional contact email.
2. Required free-text description (~40+ characters).
3. **Analyze** — follow-up questions (3–8 total), then a recommendation card.
4. **Accept** or **Edit on the form** — both apply the recommendation as a starting point. Every field remains editable.
5. **Enter details myself** skips the interview.
6. Generate quote from the structured form (source of truth).

Guest cards are always **Quantum Payments**. Each entity is its own merchant; one guest check; split capture. Gift cards stay first-party.

The UI badge is **AI recommendations** when a server key is present, otherwise **Guided recommendations** (heuristic, no model call).

## Environment

Server-only. Do not prefix with `VITE_`.

| Variable | Purpose |
|---|---|
| `XAI_API_KEY` | Preferred. Calls `https://api.x.ai/v1/chat/completions` with `grok-4.5`. |
| `OPENAI_API_KEY` | Fallback if `XAI_API_KEY` is empty. `gpt-4o-mini` at OpenAI. |

If **neither** is set, Vercel preview still works: keyword rules produce follow-ups and a recommendation. Set `XAI_API_KEY` on the Vercel project to use the model.

## Persistence

On `prospects`:

- `interview_free_text`
- `interview_messages` (JSON thread)
- `interview_recommendation` (structured JSON)
- `interview_source` (`ai` \| `heuristic`)
- `interview_status` (`none` \| `in_progress` \| `accepted` \| `skipped`)

Platform admin: Dashboard → Pipeline → open a prospect → **Interview** (transcript + recommendation).

## How to test on Vercel

1. Incognito → `/get-pricing`.
2. Paste a multi-operator bar + kitchen description (invented company, not a real customer), e.g. *“We host two kitchens and a bar under one roof. Guests pay one check. About 8 devices, 20 staff. Need floor, ODS, and operator payouts.”*
3. **Analyze**. Answer follow-ups if shown.
4. See recommendation: host + operators, venue types, modules, estimates. Toggle anything, then **Accept**.
5. Structured form is pre-filled (banner). Confirm host model, location count, modules. Complete company + Summex Payments ack → **Generate quote**.
6. Admin pipeline shows the interview transcript on that prospect.

Skip path: **Enter details myself** still reaches the same form and quote engine.
