# Competition voting and HL display frames

The working `art-admin.html` page now manages both artwork review and Spotlight competitions with the same existing gallery admin token. No additional token is introduced.

Create a draft using approved artwork, a title, description, entry limit and closing time. The admin form suggests Black Gold Spotlight and the three Swan pieces; its suggested deadline is editable and is not an announced competition until the admin saves the draft. The datetime field uses the administrator's device time zone and is stored in UTC. Open voting locks details and entries. Requests at or after the deadline are rejected even if an admin has not manually closed the competition. An admin may also close it earlier.

The feed and gallery link to a separate competition page. It displays coming-soon, open, closed and results-published states. `competition.html?preview=black-gold` is an explicit non-voting layout preview when no competition has been created, using the three approved Swan artworks. It never creates a contest, records votes or announces a deadline.

One competition choice per browser cookie is enforced by the existing `(contest_id, voter_hash)` database primary key. Gallery votes remain separate. An entry must remain published to receive a competition vote. Stale competition IDs and cross-site POST requests are rejected. Rate limiting is applied to the competition endpoint. Cookie-based limits are not verified one-person voting.

Results must be published by the admin after closing and require at least one recorded competition vote. Ties affecting the podium require a complete tie-break order and an explanation. Higher vote totals always retain priority; tie order only changes equal totals. The explanation is shown with published results. Prior competition records and results remain available by their original competition ID after the next draft is created.

The shared code-native HL frame has an ebony bevel, champagne inner edge, light mat and HL nameplate. It follows each image's natural proportions in gallery cards, feed cards, Black Gold slides, competition entries and expanded artwork views. Original image files are unchanged. This is display styling; it does not add physical framing to print orders.

Validation includes lifecycle, deadline, entry-lock, published-entry, duplicate/concurrent-choice, stale-ID, tie-review and archive tests. No competition has been opened or real competition vote submitted as part of implementation.
