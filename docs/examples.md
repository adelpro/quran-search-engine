# Example Applications

For practical insight into real-world stateless implementation, `quran-search-engine` ships with a suite of complete apps demonstrating various runtimes and frameworks under the root `examples/` directory of the repository.

## Quick Start

Use the convenience scripts to run examples:

```bash
# Setup: install dependencies and build the library
yarn playground:setup

# Run examples
yarn playground:react     # React + Vite
yarn playground:vanilla   # Vanilla TypeScript
yarn playground:angular   # Angular
yarn playground:node      # Node.js CLI
```

## Important Note for Local Development

Because the project utilizes `yarn workspace` linking (`workspace:*`), you must first build the core library out of `/src` before any example application will detect your latest changes properly.

```bash
# Build the core library once
yarn build

# Or rebuild on save iteratively
yarn build --watch
```

## Included Example Projects

Several reference frameworks are bundled to demonstrate exactly how to architect your integrations flawlessly.

| Application Type | Path                  | Run Command               | Description                                                                                 |
| ---------------- | --------------------- | ------------------------- | ------------------------------------------------------------------------------------------- |
| React + Vite     | `examples/vite-react` | `yarn playground:react`   | Feature rich web-app showcasing a full search UI in React utilizing highlighted components. |
| Vanilla TS       | `examples/vanilla-ts` | `yarn playground:vanilla` | Pure browser testing without any VDOM or React overhead.                                    |
| Angular          | `examples/angular`    | `yarn playground:angular` | Dedicated Angular component highlighting app implementation.                                |
| NodeJS CLI       | `examples/nodejs`     | `yarn playground:node`    | Bare-metal server side searching demonstrating command-line output.                         |
