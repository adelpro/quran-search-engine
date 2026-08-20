# CLI

The package publishes a `quran-search-engine` command, so the engine can be queried from a
terminal or a shell script without writing any code. It is a thin wrapper over the library:
options map onto the same arguments `search()` takes, and results come back unchanged.

For a two-line introduction see the [CLI section of the README](../README.md#cli). This page
covers the full surface.

## Installation

Run it without installing anything:

```bash
npx quran-search-engine "رحم"
```

Or install it globally:

```bash
yarn global add quran-search-engine
```

<details><summary>Other package managers</summary>
<br>
npm install -g quran-search-engine <br>
pnpm add -g quran-search-engine <br>

</details>

## Usage

```bash
quran-search-engine <query> [options]
```

One search per invocation. Options accept their value either way, so `--limit 5` and
`--limit=5` are equivalent. A multi-word query must be quoted, since two or more bare
arguments are rejected.

## Options

Defaults are the library's own defaults, not choices made for the terminal.

| Option                      | Value                    | Default        | Effect                       |
| --------------------------- | ------------------------ | -------------- | ---------------------------- |
| `--lemma` / `--no-lemma`    | —                        | on             | Word-family matching         |
| `--root` / `--no-root`      | —                        | on             | Word-root matching           |
| `--fuzzy` / `--no-fuzzy`    | —                        | on             | Approximate matching         |
| `--semantic`                | —                        | off            | Related-concept matching     |
| `--regex`                   | —                        | off            | Treat the query as a pattern |
| `--sura <n>`                | 1 to 114                 | all            | Restrict to one sura         |
| `--juz <n>`                 | 1 to 30                  | all            | Restrict to one juz          |
| `--page <n>`                | positive integer         | `1`            | Which page of results        |
| `--limit <n>`               | positive integer         | `20`           | Results per page             |
| `--format <json\|csv\|tsv>` | `json` \| `csv` \| `tsv` | readable table | Machine-readable output      |
| `--output <file>`           | file path                | stdout         | Write to a file instead      |
| `-h`, `--help`              | —                        | —              | Show the help screen         |
| `--version`                 | —                        | —              | Show the installed version   |

`--sura` and `--juz` are bounded because they name real divisions of the mushaf: a value
outside the range is rejected rather than answered with an empty result set, since returning
nothing would read as "that sura holds no matches". `--page` and `--limit` are unbounded,
because they address result pages.

The same list, with defaults, is printed by `quran-search-engine --help`.

## Query shapes recognised without a flag

These are detected from the query itself, so no option enables them:

| Shape                 | Example                                          | Behaviour                     |
| --------------------- | ------------------------------------------------ | ----------------------------- |
| Verse coordinates     | `2:255`, `1:1-7`, `2:`                           | Returns those verses directly |
| Logical operators     | `الله AND (الرحمن OR الرحيم)`, `الله NOT الرحمن` | Operators are honoured        |
| Latin transliteration | `rahman`, `bismi allah`                          | Treated as a transliteration  |

```bash
quran-search-engine "2:255"
quran-search-engine "الله NOT الرحمن"
quran-search-engine "rahman"
```

Transliteration is matched word by word, so write each word separately: `bismi allah` rather
than `bismillah`.

## Output

Without `--format`, results print as a readable table: one line per verse, then the totals,
then a breakdown of which kinds of matching produced them. Kinds that produced nothing are
left out.

```text
1:1  بسم الله الرحمن الرحيم
1:3  الرحمن الرحيم

Showing 2 of 313 results (page 1 of 157)
Matches: exact 201 · fuzzy 112
```

Note that `fuzzy` currently includes unscored matches, which is a quirk of the library's own
counts rather than of the CLI. Tracked in
[#102](https://github.com/adelpro/quran-search-engine/issues/102).

`--format` produces machine-readable output instead, delegated to `exportResults` so the
shapes are identical to the library's:

```bash
quran-search-engine "رحمة" --format json | jq .
quran-search-engine "رحمة" --format csv > results.csv
quran-search-engine "رحمة" --format tsv
```

- `json` is an array of verse objects.
- `csv` starts with a UTF-8 BOM, then the columns `sura,aya,score,matchType,text`.
- `tsv` is the same, tab-separated.

Machine-readable output contains only the data, with no headings or totals mixed in, so it can
be piped straight into another tool. With `--output`, the chosen format is written to that file
and nothing goes to stdout.

Results always go to stdout and diagnostics to stderr, so redirecting one never contaminates
the other.

## Exit codes

| Code | Meaning       | Examples                                                   |
| ---- | ------------- | ---------------------------------------------------------- |
| `0`  | completed     | Results found, and also when nothing matched               |
| `1`  | runtime error | Data could not be loaded, output file could not be written |
| `2`  | invalid usage | Unknown option, missing or blank query, value out of range |

Scripts can therefore tell "nothing matched" from a real failure without parsing any message
text.

## Running the CLI from source

Contributors do not need to install the package. Build once, then run the built entry point:

```bash
yarn install
yarn build
node dist/cli.js "رحم"
node dist/cli.js --help
```

Rebuild after changing anything under `src/`, since `dist/` is what the command runs.

To exercise it exactly as a published user would, including the `bin` link and the shebang,
pack and install the tarball into a throwaway prefix:

```bash
npm pack --pack-destination /tmp/qse
npm install --prefix /tmp/qse /tmp/qse/quran-search-engine-*.tgz
/tmp/qse/node_modules/.bin/quran-search-engine "رحم"
```

## Custom data

Custom data loading (`--quran <file>` / `--data-dir <dir>`) is not supported by the CLI; it
always searches the bundled dataset. Custom datasets remain available through the library API,
and CLI support for them is tracked as separate future work.
