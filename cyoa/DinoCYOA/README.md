# CYOA

A build-your-own-character generator that you author in a browser, play in a
browser, and hand out as a folder.

You describe a world once — what a character *is*, what can be picked, what
things cost, what they require — and the same description drives three things:
the editor you author in, the page a player fills in, and the file that player
takes away.

There is no framework, no npm install and no build step. It is plain ES modules,
one small Node server, and JSON on disk.

---

## Contents

1. [The three parts](#1-the-three-parts)
2. [Running it](#2-running-it)
3. [Ten minutes: make a game that plays](#3-ten-minutes-make-a-game-that-plays)
4. [The vocabulary](#4-the-vocabulary)
5. [The editor](#5-the-editor)
6. [The player's page](#6-the-players-page)
7. [Writing a book](#7-writing-a-book)
8. [Publishing](#8-publishing)
9. [Reference](#9-reference)
10. [The rules the system enforces](#10-the-rules-the-system-enforces)
11. [When something is refused](#11-when-something-is-refused)
12. [Tests, versions and migration](#12-tests-versions-and-migration)
13. [Where things live](#13-where-things-live)
14. [Known warts and things not built yet](#14-known-warts-and-things-not-built-yet)

---

## 1. The three parts

**The engine** (`engine/`) is the game. It loads five JSON files plus whatever
books they pin, and paints a page: rows of cards to pick from, a character sheet
that fills in as you pick, a budget, and four buttons — Download, Load, Print,
Start over. It never talks to a server. Any static host will run it.

**The editor** (`dinoEdit/`) is where you author. It is a manager first: a list
of every CYOA you have, a library of every book on the shelf, and a form to make
a new one. Open one and you get four tabs — Books, Types, Things, Rows.

**The shelf** (`books/`) is shared. A book is a folder of rules and content that
any game can build on: `basic` says what a Character *is*, `stats` bolts four
attributes onto it, `dinosaur-age` fills the shelves with dinosaurs. Books are
add-only and versioned by edition, so upgrading one can add to your game but
never silently change what is already in it.

The one idea underneath all of it: **the schema is the product.** Everything the
editor draws, the engine shows and the validator checks is read from the same
description of the data. Nothing is a special case, and there is no expression
language to learn — every rule is built from dropdowns.

---

## 2. Running it

### Requirements

* **Node 22.7 or newer.** (The engine's `.js` files are ES modules without a
  `package.json` beside them; Node detects that by syntax from 22.7 on.)
* A browser.
* Nothing else. No dependencies, no install step, no bundler.

### Start the server

From the repository root:

```bash
node cyoa/DinoCYOA/server/server.js
```

It prints where it landed:

```
Server online at http://localhost:3000 - games: …/games - books: …/books
```

### The four addresses

| URL | What it is |
| --- | --- |
| `http://localhost:3000/` | redirects to the editor |
| `http://localhost:3000/dinoEdit/` | the editor — the list of your CYOAs |
| `http://localhost:3000/games/<name>/` | play the working copy of one game |
| `http://localhost:3000/dist/<name>/` | play the published copy |

`/games/…` serves the game live off disk, so a Save in the editor shows up on the
next reload. `/dist/…` serves what you last published, which is a different thing
on purpose — see [Publishing](#8-publishing).

### Changing where it runs

Four environment variables, all optional:

```bash
PORT=3400 node cyoa/DinoCYOA/server/server.js     # a different port (0 = any free one)
CYOA_GAMES_DIR=/tmp/games …                       # a different games folder
CYOA_BOOKS_DIR=/tmp/books …                       # a different shelf
CYOA_DIST_DIR=/tmp/dist …                         # a different publish target
```

This repo also carries `.claude/launch.json` with a `cyoa` entry, so tools that
read that file can start the same server on port 3000.

### Stopping it

Ctrl-C. Nothing is left running and nothing is written on shutdown.

---

## 3. Ten minutes: make a game that plays

Start the server and open `http://localhost:3000/`.

**1. Make the CYOA.** At the bottom of the home screen, under *New CYOA*, type a
title — `Space Pirates!` — and leave **Start from the Basic book** ticked. Press
**Create**.

The server turns the title into a folder name (`games/space-pirates`), writes
five JSON files, and the editor drops you on the **Things** tab. If you had
unticked the box you would have landed on **Types** instead, because a game built
on nothing has to invent its own shapes first.

**2. Look at what you were given.** The rail on the left of the Things tab lists
seven sheets that came from Basic: Character, Item, Place, Faction, Origin, Trait
and Skill. They are empty — Basic defines shapes, it does not ship content.

**3. Put something on a shelf.** Click **Item** in the rail, then **+ Add Item**.
A card appears. Give it a name and a cost. Add two or three more. These are the
things a player will be able to pick.

**4. Say what the player builds.** Go to the **Rows** tab and open the **Page**
card at the top. Set *The player builds* to **Character**. Underneath, a note
appears telling you what that means in this game: which slots the player will
type into, and how many list sections your rows can fill. While you are here, set
the page title and the budget.

**5. Add a row.** Below the Page card, press **+ Add row**. Open it and set:

* **Label** — what the player reads above the cards, e.g. `Pick your gear`.
* **Shows** — the query. Choose type **Item**. Leave the condition off to show
  every Item, or add one to show only some.
* **Fills** — choose **Gear**. This is the binding: anything picked in this row
  lands in the Gear section of the player's sheet.
* **Show when** — leave it on *Always*.
* **Min / Max** — how many picks are required and allowed here.

**6. Save.** Press **Save all** in the top bar. The server checks all five files
against the schema *and* against the books you pinned, and refuses the whole save
if anything does not fit — naming what and where.

**7. Play it.** Press **Play ↗**. Your row is there, the cards are your Items,
picking one spends budget and writes it onto the character sheet at the bottom of
the page. Press **Download** and you get the character back as a JSON file.

**8. Publish it.** Press **Save & export**. The game is saved, then flattened —
every book it pins folded into its own files — and written to `dist/space-pirates/`
as a self-contained folder. **Preview ↗** plays that copy.

---

## 4. The vocabulary

These words mean specific things throughout the editor, the engine and this
manual.

**Game** — one CYOA. A folder under `games/` with five JSON files and an
`assets/` folder. It is also the last layer of a stack: the game's own stuff is
merged on top of the books it pins.

**Book** — a folder under `books/<name>/<edition>/`, shared by every game. A book
can define sheets, add sections and fields to other books' sheets, put things on
shelves, and propose rows and a budget.

**Shelf** — `books/`, the whole library. One shelf, read-only from the server.

**Pin** — `{ name, edition }`. A game pins the exact editions it is built on; a
book pins the exact editions it requires. Never a range.

**Type / sheet** — a shape. `Character`, `Item`, `Place`. In the data it is a
*type*; on the Things tab it is a *sheet* — the same object. A type is a list of
sections.

**Section** — a named part of a sheet, of one of two kinds:
  * **fields** — fixed slots, one value each (Identity, Attributes, Notes).
  * **list** — entries placed from another sheet's shelf (Gear holds Items,
    Skills hold Skills). A list section can carry **placement fields**: extra
    values recorded per placement, like a Skill's *Level* or an Item's *Quantity*.

**Field** — one slot: a key, a caption, a kind (text, number, lines, choice) and
optionally a default and options.

**Thing** — one entry on a shelf: a specific Item, a specific Origin. Every thing
has a name, a cost, an image filename and optionally demands. Everything else
comes from its type.

**Row** — what a player sees: a heading and a strip of cards. A row does not
*hold* things; it asks the library a question (its **query**) and shows the
answer. Rows nest.

**Query** — `{ type, where }`. Which sheet's shelf to show, and optionally one
condition to filter it by.

**Show when** — the gate on a row. `Always`, or *a thing is picked*, or *anything
in a row is picked*. Gates are positive only: a pick can reveal a row, never hide
one.

**Fills** — which section of the player's sheet a row's picks land in. Always
explicit, never guessed.

**Demand** — a condition an entry places on the player's sheet. Same three parts
as a query condition — field, operator, value — pointed at the character instead
of the shelf. This is how prerequisites and exclusions are written.

**Budget** — one number of points for the whole game. A thing's cost is spent
against it; a negative cost pays into it.

**Proposal / override** — a book *proposes* a row or a budget; a game *overrides*
it, key by key. What the game writes wins; what it leaves alone shows through.
Like a CSS cascade.

**The player's sheet** — the character. It is derived at every paint from what
the player typed and what they picked, never stored twice.

**Kept file** — the JSON a player downloads and can load back.

---

## 5. The editor

The top bar is always: the title (a link home), the open game's name, the tab
strip, a status line, **Play ↗**, **Preview ↗** (once exported), **Save & export**
and **Save all**.

The address bar carries where you are: `#home`, `#<game>/rows`,
`#<game>/things/<typeId>`. Bookmarks and the back button work.

Leaving a game with unsaved edits asks first.

### 5.1 Home

Three things stacked:

* **One card per CYOA** — its title, its folder, its schema version, how many
  types, things and rows it has *after* merging its books, which books it pins,
  and whether it has been exported. Buttons: **Open**, **Play ↗**, **Export**,
  and **Preview ↗** once there is something to preview. The counts are the merged
  ones, so a game built on Basic shows 7 types even though its own `types.json`
  is empty.
  A folder that is not a game is still listed, with its problem written out and
  nothing to click.

* **Library** — one card per book on the shelf, one line per edition: what it
  requires, how many sheets it defines, how many sections and fields it adds, how
  many shelf entries it ships, what it proposes. A broken edition is listed with
  its problem rather than hidden.

* **New CYOA** — a title box and, when the shelf has a clean Basic, a **Start
  from the Basic book** checkbox (ticked by default). The folder name is made
  from the title; the receipt tells you which name you got.

### 5.2 Books tab

Which books this game is built on. It is first because it is the first question —
everything the other three tabs show is a merge of these books with the game's
own stuff.

One card per pinned book, **in merge order** (a book always after the books it
requires), each saying what that book brings. On each card:

* **Upgrade to edition N** when a newer clean edition is on the shelf.
* **Remove** — disabled, with a reason, when another pinned book requires this
  one.

Pins that did not load get a red card carrying the merge's own sentence for why,
plus a one-click fix when there is one.

At the bottom, **Add a book from the shelf**: every book you do not already pin,
at its latest clean edition. Adding one adds whatever it requires too.

### 5.3 Types tab

The sheets. Books' sheets first, read-only, in merge order — they are the ground
you are standing on. Then your own, editable.

A type is a label and a list of sections. A section is a key, a caption, and a
kind:

* **Fields (fixed slots, one value each)** — then a list of field definitions.
* **List (entries placed from a shelf)** — then *Entries from* (which sheet's
  shelf) and *Placement fields* (extra values per placement).

A field is a key, a caption and a kind: **Text**, **Number**, **Lines (one per
line)** or **Choice (one of a list)**. A choice needs at least one option, one per
line. Defaults are read-only here — books author them.

> **Name a field before you add things of its type.** Things store values under
> the key. Renaming a key later leaves the old values behind under the old name.

### 5.4 Things tab

The shelves. A rail on the left lists every sheet with its count; the pane on the
right shows one shelf.

A book's things appear as locked cards. Your own are editable. Every card has
the core three — **Name**, **Cost**, **Image filename** — then whatever its type
defines, then **Demands**.

* **+ Add \<Sheet\>** makes a new thing. The **from** dropdown beside it chooses a
  template: *— blank —*, or any thing already on that shelf, including a book's.
  Copying a book's thing is how a book ships a starting point.
* **▲ ▼** on each card arrange the shelf. The arrangement is yours even over a
  book's things — it lives in your `things.json`. **Reset order** drops it.
* Under a **list** section, **+ Add \<Section\>** places an entry from the shelf
  that section draws on, and shows that placement's own fields beside it. A
  placement field that multiplies cost is marked `· multiplies cost`.

**Demands** is where prerequisites and exclusions are written. Press **+ Add
demand** and build a condition from three dropdowns: a slot on the player's
sheet, an operator, a value. Above the list, the same sentence the player will
read is printed — `Needs: Origin holds Tyrannosaurus`. An entry with no demands
carries no key at all; removing the last one deletes it.

The button is disabled with a reason when this game builds no sheet, or when the
sheet has nothing to demand anything of.

### 5.5 Rows tab

What the player sees, top to bottom.

**The Page card** first — everything that is not a row:

* Page title and hero title.
* **The player builds** — which type the player fills in, or nothing (which makes
  the game a plain menu of pickers). The note under it reads the merged library:
  what the player types, and how many list sections rows may fill.
* **Total budget** — blank means "let a book's proposal show through".
* Page theme: background, font, hero image, status bar colours.

Then **every row a pinned book proposes**, each with your overrides beside it —
label, query, fills, show when, hidden. Write one and it wins; leave it and the
book's shows through.

Then **your own rows**, as a plain nested list. Each row card holds:

* **Label**, **Shows** (the query), **Fills**, **Show when**
* **Min points / Max points** — despite the caption these count **picks**, not
  points and not quantities. `Max 3` on Gear means three different entries.
* **Background** — this row's own colour.
* **Nested rows** — children, gated independently.

Every card carries a one-line summary while folded, and warning badges when
something in it cannot be evaluated — a filter naming a field that no longer
exists, a gate waiting on a deleted row, a row that can never appear.

Above every tab, in red, is the **faults banner**: what the merge could not do.
Each line links to the tab that owns it. A fault is why the next save will be
refused, so it follows you around.

### 5.6 Saving

**Save all** writes all five files. The order matters and is deliberate: the four
data files go first, in parallel, and `content.json` goes last and only if all
four landed. `content.json` carries every cross-reference and every pin, so it is
checked against its four siblings *as they sit on disk* and against the books it
names. A partial save can therefore never leave a game that refuses to load.

A refusal names every problem by path and writes nothing.

**Save & export** saves, then publishes — so what gets published is what is on
screen. The **Export** button on the home screen publishes what is on disk,
because nothing is open there.

---

## 6. The player's page

The page is the rows, then the sheet.

**Cards.** Each shows a picture, `Name - N points`, and a button in one of five
states:

| Button | Meaning |
| --- | --- |
| **Select** | you can take it |
| **Selected** | you have it; click to put it back |
| **Full** | this row is at its max |
| **Locked** | a rule says no — hover, or read the line on the card |
| **Too expensive** | you cannot afford it |

The rules are checked **before** the money, on purpose: telling someone to save up
for something they can never have is a lie.

A card with demands prints them: `Needs: Origin holds Tyrannosaurus`. A card that
would break something you already hold says which thing it would break.

**Quantities.** When a row fills a section whose placement fields include a
number keyed `quantity`, each pick gets a stepper, and the quantity multiplies the
cost. Nothing else moves the budget.

**The sheet.** Below the rows: a Name box, every fields section as inputs
(text, number, lines, choice), and every list section showing what the rows put
there — with each placement's own values editable inline.

**Status.** A line that always says where you stand: what you have spent, what is
left, which rows still need picks, and — in words — when something was removed
and why.

**The four buttons.**

* **Download** — the character as JSON, named after the character.
* **Load…** — read one back.
* **Print** — the browser's print dialog, laid out as a character sheet.
* **Start over** — asks first, then clears everything including the autosave.

**Autosave.** Every change is written to `localStorage`, keyed by the page's own
path — so a draft made at `/games/dino/` does not appear at `/dist/dino/`. A
private window or blocked site data makes this fail, and the page says so in a
sentence rather than breaking; Download still works.

**Loading a sheet into a changed game.** Two severities, and the split is the
point:

* The file's **identity** being wrong — a different game's sheet, a newer file
  format — refuses the whole file. Nothing is loaded, and the refused bytes stay
  downloadable.
* A **reference** inside it being gone — a rock you picked that the author has
  since deleted — drops *that* entry, by name, in a note, and loads the rest.

A removed rock must not cost a player their character.

---

## 7. Writing a book

You can author a book two ways: **in the editor**, from the Library on the home
screen, or by writing the JSON yourself. Both produce the same folder, and the
editor refuses anything the hand-written form would be refused for.

A book is a folder. Nothing registers it; putting it on the shelf is the whole
installation.

```
books/<name>/<edition>/
  book.json          required — the manifest
  types.json         optional — sheets it defines, sections and fields it adds
  things.json        optional — what it puts on shelves
  proposals.json     optional — rows and a budget it proposes
  assets/            optional — pictures its things name
```

`<name>` is lowercase letters and digits with single dashes, up to 40 characters.
`<edition>` is a positive integer, as a folder name.

### From the editor

On the home screen, under **Library**:

* **New book** — a title, an optional folder name (it is also the id namespace),
  and the books it requires. A book may not require itself.
* **Edit** — opens the book in the same four tabs a game uses. The differences:
  its first tab lists what it **requires** rather than what it pins, its Rows tab
  edits what the book *proposes*, and there is no page theme, no player-sheet
  declaration and no Play or Export — a book is not played.
* **Cut edition N as a copy** — the only way to change an edition a game pins.
* **Rename…** — renames the folder *and* the id namespace, rewriting every id in
  the book and every pin that names it. It previews the counts first.
* **Delete edition** / **Delete book…** — refused while any local game pins it,
  naming which.

Ids you make in a book are minted as `<book>:<noun>-<n>` — never from the
caption, because an id must not follow a later rename.

### Save as a book

A game's own layer is already book-shaped, so the editor can lift it onto the
shelf: **Save as a book** on a game's card. It moves the game's own sheets,
entries and rows, rewrites every id into the new namespace, and leaves the game
pinning the new book — playing exactly as it did.

It previews what will and will not travel first, because some things cannot:

* row overrides stay — a book may not override another book's row
* the shelf arrangement stays — a book has no merged shelf to arrange
* the player-sheet declaration, page title and theme stay
* a picture's **filename** travels but the **file** does not — copy it into the
  book's `assets/` by hand

### book.json

```json
{
  "name": "dinosaur-age",
  "title": "Dinosaur Age",
  "edition": 2,
  "requires": [
    { "name": "basic", "edition": 1 },
    { "name": "stats", "edition": 1 }
  ]
}
```

`name` must equal the folder. `edition` must equal the edition folder.
`requires` is **flat** (write out every transitive requirement) and **exact**
(editions, not ranges).

### Namespacing

Every id a book writes must be in its own namespace: `<book>:<slug>`, and dots
for depth.

```
basic:character
basic:character.identity
basic:character.identity.concept
stats:strength
dinosaur-age:kind
```

A book may only define ids under its own name. That single rule is what makes the
merge safe: two books can never collide, and you can always see which book a
thing came from.

### The three shapes a book can take

**Define sheets** — `types.json` with entries in `types`. This is what `basic`
does: it says what a Character, an Item, a Place *are*, and defines the sections
they hold, including empty ones for other books to fill.

**Add to someone else's sheets** — `types.json` with `sectionsFor` and
`fieldsFor`, keyed by the *target's* id. This is what `stats` does:

```json
{
  "version": 7,
  "types": [],
  "sectionsFor": {},
  "fieldsFor": {
    "basic:character.attributes": [
      { "id": "stats:strength", "key": "strength", "caption": "Strength",
        "type": "number", "default": 10 }
    ]
  }
}
```

Four fields land in Basic's empty Attributes section without touching Basic.

**Ship content and rows** — `things.json` and `proposals.json`. This is what
`dinosaur-age` does: six Origins, six Traits, four Skills, four Items, four
Places, plus four rows and a budget of 10.

`proposals.json` is the rows half of `content.json` and the whole of `rules.json`
in one file:

```json
{
  "version": 7,
  "totalBudget": 10,
  "groups": [ { "id": "dinosaur-age:row-gear", "label": "Gear",
                "query": { "type": "basic:item", "where": null },
                "showWhen": { "kind": "always" }, "children": [] } ],
  "groupRules": { "dinosaur-age:row-gear": { "min": 0, "max": 3 } }
}
```

Books propose no themes and no overrides.

### Editions

An edition is frozen. To change a book, copy the folder to the next number and
add to the copy. `dinosaur-age/2` is `dinosaur-age/1` plus one Place (`Nest`).

That is why upgrading is safe and why the Books tab can offer it as one click: an
add-only edition cannot change what your game already shows.

**An edition a game pins is frozen, and the editor enforces it.** Opening one
gives you a read-only view with a sentence naming the game that pins it and a
one-click *Cut edition N+1 as a copy*. Nothing you click in that view writes.

The check is about **your** games folder — it is the honest local truth, not a
claim about the world. A book you send someone else is theirs to fork.

### Checking your book

Restart nothing — the shelf is read fresh on every request. Reload the editor's
home screen: your book appears in the **Library** with its facts, or with its
problem written out. A book with any problem may sit on the shelf but will not be
offered for pinning.

---

## 8. Publishing

Publishing writes a self-contained folder that plays from any static host, any
subpath, or a memory stick — with no server, no shelf, and no build step.

From the editor: **Save & export** inside a game, or **Export** on a game's home
card.

From the command line:

```bash
node cyoa/DinoCYOA/tools/export.mjs <game>
```

with optional `--out <dir>`, `--game-dir <dir>`, `--books-dir <dir>`.
Exit code `0` written, `1` usage, `2` refused.

### What lands in the folder

* the engine, verbatim (every path in it is page-relative, so nothing is rewritten)
* the game's five data files, **flattened** — every pinned book's sheets, things
  and proposals folded in, `books: []`, no arrangement left to apply. The published
  engine takes five fetches and never asks for a shelf.
* `assets/` — the union of the game's own assets and every pinned book's, in layer
  order, flattened into one folder
* `.cyoa-export.json` — a manifest with a sha256 of every file

A game that pins nothing travels as its committed bytes, unflattened, because
re-serialising files that are already right buys nothing.

### The safety rule

The tool works in this order:

```
read → version gate → the shelf → contract gate → out-dir guards
  → wipe → claim → copy → verify in child processes → manifest last
```

Every refusal that concerns the **source** happens before anything under `--out`
is touched, so a refused export leaves your previous one intact. Nothing is ever
deleted without the `.cyoa-export.json` marker this tool itself wrote. Two runs
on the same tree are byte-identical — no timestamps, no git hash.

`dist/` is gitignored. It is build output; rebuild it, don't commit it.

---

## 9. Reference

### Field kinds

| Kind | Stored as | Editor control |
| --- | --- | --- |
| `text` | string | one-line input |
| `number` | number | number input |
| `lines` | array of strings | textarea, one entry per line |
| `choice` | string | dropdown; needs at least one option |

A field with no value reads as its own `default`, else (for a choice) its first
option, else its kind's blank (`""`, `0`, `[]`, `""`).

### Query and demand operators, by field kind

| Kind | Operators |
| --- | --- |
| text, choice | `is`, `is not` |
| number | `=`, `≠`, `<`, `≤`, `>`, `≥` |
| lines | `has the line`, `lacks the line` |

### Demand operators for a list section

| Operator | Holds when |
| --- | --- |
| `holds` | that thing is in the section |
| `does not hold` | it is not |
| `holds anything` | the section is not empty |
| `holds nothing` | the section is empty |

`holds anything` and `holds nothing` take no value.

A demand may name any **fields** field or any **list** section of the player's
sheet. It may never name `name`, `imageURL` or `cost`: cost on a sheet is *spent*,
derived from the very picks being judged, and a condition on it would be circular.

### Show-when kinds

| Kind | The row appears when |
| --- | --- |
| `Always` | always |
| `A thing is picked…` | that thing has been picked, in a visible row |
| `Anything in a row is picked…` | that row is visible and has at least one pick |

Gates are **positive only**. A pick can reveal a row; it can never hide one. That
is what makes visibility settle to one answer no matter what order things are
evaluated in — two rows that wait on each other simply never appear, which is
honest, because from a blank sheet neither could ever get its first pick.

A row whose gate points at something deleted becomes *never*, loudly.

### The `quantity` convention

A **placement field keyed `quantity` whose kind is `number`** multiplies its
entry's cost. Nothing else moves the budget.

It is a naming convention rather than a flag because placement fields live inside
a frozen book edition, and a game cannot add a field to a list section — a flag
would cost a new edition of `basic` and of everything requiring it. The trap is
lit rather than left: the validator refuses a `quantity` placement field that is
not a number, so a collision is a save-time sentence, never a silent ×1.

`min` and `max` on a row count **picks**, never quantities. Three Cute Rocks are
one pick.

### Names and ids

| Thing | Grammar |
| --- | --- |
| game folder | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤ 40 chars; `home` is reserved |
| book folder | the same grammar |
| edition | a positive integer |
| a book's ids | `^[a-z0-9]+(-[a-z0-9]+)*:[a-z0-9]+([.-][a-z0-9]+)*$` |

Titles are turned into folder names by stripping accents, lowercasing, and
collapsing anything that is not a letter or digit into a single dash.
`Space Pirates!` → `space-pirates`.

### A game's files

```
games/<name>/
  data/content.json    meta, pins, the player's sheet, rows, overrides
  data/rules.json      the budget, per-row min/max
  data/themes.json     page theme, per-row backgrounds
  data/types.json      the game's own sheets, and its additions to books'
  data/things.json     the game's own shelves, and its arrangement of merged ones
  assets/              pictures
```

All five carry a `version`.

### HTTP routes

| Method | Route | Does |
| --- | --- | --- |
| GET | `/api/games` | list every game, with merged counts |
| POST | `/api/games` | `{ title, books? }` → make one |
| GET | `/api/books` | the whole shelf, with problems |
| POST | `/api/games/<name>/save/<file>` | save one of the five files |
| POST | `/api/games/<name>/export` | publish |
| POST | `/api/games/<name>/extract` | `{name, title}` → lift its own layer onto the shelf |
| POST | `/api/books` | `{title, name?, requires?}` → make one at edition 1 |
| POST | `/api/books/<n>/<e>/save` | save the whole book, atomically |
| POST | `/api/books/<n>/<e>/cut` | edition N+1 as a copy |
| POST | `/api/books/<n>/<e>/delete` | one edition |
| POST | `/api/books/<n>/delete` | the whole book |
| POST | `/api/books/<n>/rename` | `{to}` → rewrite the namespace and every pin |
| GET | `/games/<name>/…` | the game, live |
| GET | `/dist/<name>/…` | the published copy |
| GET | `/books/<name>/<edition>/…` | the shelf, read-only |

Every API answer is `{ ok, … }`. A refusal carries `problems: [{ path, message }]`.

The **static** shelf is read-only: there is no route under `/books/` that writes.
Every write goes through `/api/books`, which validates with `validateBook` and
writes an edition atomically — into `<edition>.tmp/` and then one `rename(2)` —
so a crash leaves a `.tmp` folder, never a half-written book.

---

## 10. The rules the system enforces

These are not style preferences; they are checked, and breaking them is refused
with a sentence.

**Books are add-only.** A book can define new sheets, add sections and fields to
existing ones, put things on shelves, and propose rows and a budget. It cannot
remove, rename or redefine anything another book wrote.

**Merge order is pin-order-independent.** Books are laid down in dependency order
(a book always after everything it requires), with ties broken by name. Reordering
your pins cannot change the result.

**A game is the last layer.** Your own stuff merges on top of every book. Your
`types.json` and `things.json` are the same shapes a book writes — the game's own
stuff is just its own book, loaded last.

**The cascade.** For a proposed row or the budget: a key you write wins, a key you
leave alone lets the book's proposal show through. Per key, like CSS.

**Bindings are explicit.** A row says which section it fills. It is never inferred
from the shapes, because inference is ambiguous on the very first book (Advantages
and Disadvantages both hold Traits) and because inference cannot say "nothing" —
a row would start filling a section the day a book added one, which is exactly
what the merge exists to prevent.

**Everything is checked at the border.** Files are validated when saved, when
loaded and before export. Inside those doors, the code trusts what it has. A
value that cannot be understood makes the thing carrying it fail *closed* — it is
not offered — and says so once, by name, in the console.

**Nothing widens silently.** A broken filter shows nothing, not everything. A
broken gate is *never*, not *always*. A demand that cannot be judged fails.

**At most one thing is ever taken away.** When a change breaks what you hold —
you drop the Origin that let you take a Trait — the settle removes exactly one
pick per pass, always the last failing one in a fixed order, and says so. It
terminates, it lands on the same answer every time, and a click that would take
something away from you is disabled before you make it rather than punished after.

---

## 11. When something is refused

Every refusal names a path and a problem. The common ones:

| You see | It means |
| --- | --- |
| `content.json does not fit the schema` | one of the five files disagrees with the contract; every problem is listed by path |
| `<file>.json on disk cannot be read — save it first` | `content.json` is checked against its four siblings *as they sit on disk*; one is missing or unparsable |
| `"<name>" <n> is not on the shelf` | a pin points at a book folder or edition that is not there |
| a red **book fault** banner | the merge could not lay a layer down; the line links to the tab that owns it |
| `names a field that does not exist (…)` | a filter or demand points at a field that has been deleted |
| `names a row that does not exist (…)` | a gate waits on a deleted row |
| `waits for itself` | a gate waits on its own row or one nested inside it |
| `operator "…" does not fit a <kind> field` | the field's kind changed under a condition built for the old one |
| `this game builds no sheet` | a row has a *Fills*, or a thing has a demand, but *The player builds* is empty |
| `a CYOA named "…" already exists` | the folder name that title makes is taken |
| `"…" is a name the editor keeps for itself` | you titled a game something that slugs to `home` |

If the editor will not open a game at all, its files are on disk and readable —
the server never deletes. Look at the console: the border warns once per fault,
by name.

---

## 12. Tests, versions and migration

### Running the tests

```bash
node cyoa/DinoCYOA/tools/oracles-logic.mjs
```

66 pure checks over the schema, the migrations, the query and visibility
vocabularies, the validator, the merge, the player's sheet, the kept file and the
demands. Milliseconds; touches no disk.

```bash
node cyoa/DinoCYOA/tools/oracles.mjs
node cyoa/DinoCYOA/tools/oracles.mjs vampire
```

105 checks, the logic ones first, then the slow half: git history, temp
directories, child processes, a real server on a free port and the real shelf.
It proves among other things that old data still plays the same, that the shelf
is never written to, and that the real `games/` and `dist/` are untouched by the
run.

Both are plain `node:assert`. The first failure throws and the process exits
non-zero.

### The schema version

`SCHEMA_VERSION` in `engine/config/schema.js` is currently **7**. Every data file
carries a `version`.

Migration is one-way, pure and automatic: an older file is climbed to the current
version *at the border* whenever it is loaded, and written at the current version
whenever it is saved. Migrations mint nothing random, so migrating twice is
byte-identical.

You do not have to migrate anything by hand. Opening an old game and pressing
**Save all** writes it forward. A game that has not been opened since a bump plays
fine — it climbs on load — and its home card says *Open and Save to migrate*.

### The kept file's version

A downloaded character carries `KEPT_VERSION`, currently **1**, which is
deliberately *not* the schema version. A schema bump must not invalidate every
character anyone ever saved. A kept file from a *newer* version than the game
knows is one loud refusal.

---

## 13. Where things live

```
cyoa/DinoCYOA/
  engine/              the game
    index.html
    app.js             the only file that touches localStorage, Blob, print, location
    state.js           what is true about a play
    view.js            what is on screen
    config/
      schema.js        the contract, as data — everything else reads it
      merge.js         layers, order, the cascade, the game validator
      sheet.js         the player's sheet: its vocabulary and its cost rule
      demands.js       what an entry asks of the player
      query.js         a row's question and its operators
      visibility.js    when a row is on screen
      references.js    walking and repairing the row tree
      validate.js      the border checks
      migrations.js    v1 → v7, one way
      kept.js          the file a player takes away, and the door back in
      gameConfig.js    the border itself — validate, default, translate
      loadData.js      the five fetches

  dinoEdit/            the editor
    index.html  main.js  view.js  books.js  home.js
    state.js  uiState.js  loadData.js  saveData.js  helpers.js  styles.css

  server/              one server for every game
    server.js  games.js  books.js

  books/               the shelf
    basic/1/  stats/1/  dinosaur-age/1/  dinosaur-age/2/

  games/               your CYOAs
    dino/  vampire/  space/

  dist/                published folders (gitignored, rebuilt on demand)

  tools/
    export.mjs             the publisher
    oracles-logic.mjs      66 pure checks
    oracles.mjs            105 checks
    restructure-v4.mjs     a one-off migration script
    rebuild-dino-v5.mjs    a one-off rebuild script
```

`dino2/`, `firstCYOA/`, `toy-machine/` and `engine/stuff.js` are earlier drafts
and scratch. They are not part of the system.

### The shape of the code

Four tables do most of the work, and each is read by more than one part of the
system:

* `FIELD_BUILDERS` — how the **editor** edits a kind
* `DISPLAY_BUILDERS` — how the **game** shows a kind
* `INPUT_BUILDERS` — how the **player** fills a kind in
* `CHECKERS` — how the **validator** judges a kind

Adding a new kind of thing means adding a row to each table, not a branch in a
walker. When a lookup misses, it warns once, by name, and fails closed.

The import graph under `engine/config/` is deliberately acyclic:

```
schema.js ─┬─ query.js ──┐
           ├─ sheet.js   ├── demands.js ── references.js ── validate.js ── kept.js
           └─ visibility.js
```

Everything in `engine/config/` is DOM-free, fetch-free and does no work at import
time, so Node runs the same bytes the browser runs. That is what lets the tests be
this thorough.

---

## 14. Known warts and things not built yet

**Warts**

* A row's min/max are captioned **Min points** and **Max points** in the editor,
  but they count **picks**. The captions are wrong; the behaviour is right and is
  what everything else assumes.
* `games/vampire` is still schema v4 on disk. It plays correctly because it
  migrates on load. Opening it and pressing Save all would write it forward —
  it is left alone on purpose as a compatibility proof.
* `engine/stuff.js` is scratch and untracked.

**Deferred, with the shape already decided**

* A **player** taking a template (the author's half exists; `"@sheet"` is
  reserved by being refused).
* Computed slots — a field whose value is derived from others.
* A book overriding another book. Today only a game overrides, and only its own
  house-rules layer. This is what "Save as a book" cannot carry.
* Asset upload. A book has an `assets/` folder and the serving side is complete,
  but nothing uploads a picture — for a game either. Filenames travel; files are
  copied by hand.
* Quantities in demands ("three of these") — a fifth placement operator taking a
  number, and nothing else moves.

**Deliberately never**

* An expression language. Every rule is a structured object built from dropdowns.
  A rule you can *type* is a rule the editor cannot check, cannot offer options
  for, cannot repair when something it names is deleted, and cannot explain to a
  player in the same words the author wrote it in. All four of those are things
  this system does, and it does them because the rules are data.
