# Example Applications

For practical insight into real-world stateless implementation, `quran-search-engine` ships with a suite of complete apps demonstrating various runtimes and frameworks under the root `examples/` directory of the repository.

## Important Note for Local Development

Because the project utilizes `pnpm workspace` linking (`workspace:*`), you must first build the core library out of `/src` before any example application will detect your latest changes properly.

```bash
# Build the core library once
pnpm build

# Or rebuild on save iteratively
pnpm build --watch
```

## Included Example Projects

Several reference frameworks are bundled to demonstrate exactly how to architect your integrations flawlessly.

| Application Type | Path                  | Run Command                       | Description                                                                                 |
| ---------------- | --------------------- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| React + Vite     | `examples/vite-react` | `pnpm -C examples/vite-react dev` | Feature rich web-app showcasing a full search UI in React utilizing highlighted components. |
| Vanilla TS       | `examples/vanilla-ts` | `pnpm -C examples/vanilla-ts dev` | Pure browser testing without any VDOM or React overhead.                                    |
| Angular          | `examples/angular`    | `pnpm -C examples/angular start`  | Dedicated Angular component highlighting app implementation.                                |
| NodeJS CLI       | `examples/nodejs`     | `pnpm -C examples/nodejs start`   | Bare-metal server side searching demonstrating command-line output.                         |
