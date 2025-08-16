# react-htx

Use HTML on the server to compose your react application.

## Install

```bash
npm install react-htx
```

react is a *peer dependency*, so make sure it's installed in your project:

```bash
npm install react
```

## Build (for development of this lib)
```bash
npm install
npm run build
```

## Usage
```ts
import { App } from 'react-htx';

export default function Example() {
  return <App message="Hi!" />;
}
```
