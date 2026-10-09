# Background art audit — missing photos

Generated 2026-10-08 from data/bg-default.json vs img/bg-default/ on disk.

Every day of the year (1-365) has a config entry with an explicit `image` path of the form
`img/bg-default/<month>/<day>.png`. A day whose file is absent is not a soft fallback: the
day entry always supplies a string, so `resolveDailyBackground` never reaches the `default`
block, the `<img>` fires `error`, and bg-default.html removes it — leaving a plain black page.

| Month | Art present | Days in config | Days MISSING art |
|---|---|---|---|
| January | 13 | 31 | **18** |
| February | 11 | 28 | **17** |
| March | 7 | 31 | **24** |
| April | 30 | 30 | 0 |
| May | 31 | 31 | 0 |
| June | 30 | 30 | 0 |
| July | 31 | 31 | 0 |
| August | 31 | 31 | 0 |
| September | 3 | 30 | **27** |
| October | 3 | 31 | **28** |
| November | 3 | 30 | **27** |
| December | 13 | 31 | **18** |
| **Total** | **206** | **365** | **159** |

## Missing days by month

### January

3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21

### February

12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28

### March

6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 31

### April

_complete — nothing missing_

### May

_complete — nothing missing_

### June

_complete — nothing missing_

### July

_complete — nothing missing_

### August

_complete — nothing missing_

### September

2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30

### October

2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30, 31

### November

2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30

### December

1, 2, 3, 4, 5, 6, 7, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28

## Also missing: the global fallback

`data/bg-default.json` -> `default.image` points at `img/bg-default/default.png`, which does
not exist anywhere in the repo and never has. So the config’s stated last-resort image is
itself a 404.

## What the 159 actually are

They are not pictures that exist somewhere else under a different name — they are **empty day
slots**. Verified three ways:

- **No file on disk** at the configured path.
- **No copy anywhere in the repo**: the 206 files on disk contain only **83 unique pictures**
  by content hash, and none of them is one of the 159 (each missing path is referenced by one
  day only).
- **Never committed**: `git log --all --name-only -- img/bg-default` lists every image path
  that has ever existed in any commit; **0 of the 159 appear in it.** Nothing was deleted or
  moved away — the art was simply never added.

There is also **no record of what each one should look like**. The config stores only a path
(`img/bg-default/<month>/<day>.png`), with no title, alt text, or manifest, so the intended
content of the 159 cannot be recovered from the repository.

### The art that does exist

| Group | Months | Pictures |
|---|---|---|
| Shared pool | April–August | the same **30** pictures, cloned into each month |
| Month-specific | January, February, March, September, October, November, December | **53** pictures, each appearing in exactly one month |

30 + 53 = the 83 unique pictures on disk. The seven partial months use **one unique picture per
day with no reuse**, so their gaps cannot be filled from another month — only the 30-picture
pool is reusable, and only inside April–August.

Per month, distinct pictures on disk: January 13, February 11, March 7, September 3,
October 3, November 3, December 13.
