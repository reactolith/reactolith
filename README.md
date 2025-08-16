# ⚡️ react-htx

> **Proof of Concept** – This project is still experimental and **not ready for production**.

`react-htx` lets you **write React components directly in HTML** — making it possible to render and hydrate a React app using server-generated HTML from any backend (e.g. Symfony/Twig, Rails, Laravel, Django, etc.).

✨ Instead of manually wiring React components everywhere, just return HTML from your backend and `react-htx` will transform it into a live, interactive React application.

It even includes a **built-in router** that intercepts link clicks and form submissions, fetches the next page via AJAX, and updates only what changed — **keeping React state intact between navigations**.

---

## 🚀 Features
- 🔌 **Backend-agnostic** – Works with any backend (Symfony, Rails, Laravel, etc.)
- 🛠 **Use existing backend helpers** (Twig path functions, permission checks, etc.)
- 🔄 **State preserved across pages** – No resets on navigation
- 📋 **Form support** – Modify forms dynamically (e.g., add buttons on checkbox click) **without losing state or focus**
- 🪶 **Lightweight** – Just a few lines of setup, no heavy dependencies

---

## 📦 Installation

```bash
npm install react-htx
```

Since react and react-dom are peer dependencies, make sure to also install them:
```bash
npm install react react-dom
```

---

## 💡 Usage

Your backend returns simple HTML:

```html
<html lang="en">
  <body>
    <div id="htx-app">
      <h1>Hello world</h1>
      <ui-button>This will be a shadcn button</ui-button>
    </div>
  </body>
</html>
```

Your frontend mounts the react-htx app: 
```ts
// app.ts
import loadable from '@loadable/component'
import { App } from 'react-htx'

const component = loadable(
  async ({ is }: { is: string }) => {
    return import(`./components/ui/${is.substring(3)}.tsx`)
  },
  {
    cacheKey: ({ is }) => is,
    // Since shadcn files don’t export a default,
    // we resolve the correct named export
    resolveComponent: (mod, { is }: { is: string }) => {
      const cmpName = is
        .substring(3)
        .replace(/(^\w|-\w)/g, match => match.replace(/-/, '').toUpperCase())
      return mod[cmpName]
    },
  }
)

// Uses the HTML element with id="htx-app" as root
new App(component)
```

### 🎨 Example with Custom Root Component & Selector
```ts
// app.ts
import loadable from '@loadable/component'
import { App } from 'react-htx'
import { AppProvider } from './providers/app-provider.tsx'

const component = loadable(
  async ({ is }: { is: string }) => import(`./components/${is}.tsx`),
  { cacheKey: ({ is }) => is }
)

new App(component, AppProvider, '#app')
```

```tsx
// providers/app-provider.tsx
import React, { ElementType } from "react"
import { App, RootComponent } from "react-htx"
import { RouterProvider } from "react-aria-components"
import { ThemeProvider } from "./theme-provider"

export const AppProvider: React.FC<{
  app: App
  element: HTMLElement
  component: ElementType
}> = ({ app, element, component }) => (
  <React.StrictMode>
    <RouterProvider navigate={app.router.navigate}>
      <ThemeProvider>
        <RootComponent element={element} component={component} />
      </ThemeProvider>
    </RouterProvider>
  </React.StrictMode>
)
```

---

## 🔄 Navigation Without Losing State

When navigating, `react-htx` fetches the **next HTML page** and applies **only the differences** using React’s reconciliation algorithm.
👉 This means component state is preserved (e.g., toggles, inputs, focus).

```html
<!-- page1.html -->
<div id="htx-app">
  <h1>Page 1</h1>
  <ui-toggle json-pressed="false">Toggle</ui-toggle>
  <a href="page2.html">Go to page 2</a>
</div>
```

```html
<!-- page2.html -->
<div id="htx-app">
  <h1>Page 2</h1>
  <ui-toggle json-pressed="true">Toggle</ui-toggle>
  <a href="page1.html">Go to page 1</a>
</div>
```

Only the `<h1>` text and the `pressed` prop are updated — everything else remains untouched ✅.

---

## 🤝 Contributing

Contributions are welcome!
Feel free to open an issue or submit a PR.

--- 

## 🛠 Development Build
If you’re contributing to this library:

```bash
npm install
npm run build
```
