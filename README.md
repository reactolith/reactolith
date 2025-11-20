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
- 📡 **Real-time updates** – Works with Mercure Server-Sent-Events to push updates from the backend to the frontend

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

### How It Works

1. **Initial Load**: Symfony renders HTML with Twig, `react-htx` hydrates it into React components
2. **Navigation**: Clicking links fetches new HTML via AJAX, React reconciles the differences
3. **Real-time**: Mercure pushes HTML updates from server, UI updates automatically
4. **State Preserved**: React component state survives both navigation and real-time updates

---

## 💡 Usage

Your backend returns simple HTML:

```html
<html lang="en">
  <body>
    <div id="htx-app">
      <h1>Hello world</h1>
      <ui-button type="primary">This will be a shadcn button</ui-button>
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

## Props

If you pass props to your htx components like this: 
```html
<my-component enabled name="test" data-foo="baa" as="{my-other-component}" json-config='{ "foo": "baa" }'
```

your components will get this props: 
```tsx
const props = {
    enabled: true,
    name: 'test',
    foot: 'baa',
    as: <MyOtherComponent />,
    config: { foo: 'baa' },
}
```

---

## Slots

react-htx also provides a simple slot mechanism: Every child if a htx-component with a slot attribute will be 
transformed to a slot property, holding the children of the element:

```html
<my-component>
    <template slot="header"><h1>My header content</h1></template>
    <div slot="footer">My footer content</div>
</my-component>
```

your components will get this props:

```tsx
function MyComponent({ header, footer } : { header : ReactNode, footer : ReactNode }) {
    <article>
        <header>{header}</header>
        <div>My content</div>
        <footer>{footer}</footer>
        <aside>
            <footer>{footer}</footer>
        </aside>
    </article>
}
```

---

## 📡 Real-time Updates with Mercure

`react-htx` supports **Server-Sent Events (SSE)** via [Mercure](https://mercure.rocks/) for real-time updates from your backend. When the server publishes an update, the HTML is automatically rendered — just like with router navigation.

Mercure automatically subscribes to the **current URL pathname** as the topic and re-subscribes when the route changes.

```typescript
import { App, Mercure } from "react-htx";

const app = new App(component);
const mercure = new Mercure(app);

// Subscribe to Mercure hub (uses current pathname as topic)
mercure.subscribe({
  hubUrl: "https://example.com/.well-known/mercure",
  withCredentials: true,  // Include cookies for authentication
});

// optional listen to events
mercure.on("sse:connected", (url) => {
  console.log("Connected to Mercure hub");
});
```

When the user navigates to a different route, Mercure automatically reconnects with the new pathname as the topic.

### Mercure Events

| Event | Arguments | Description |
|-------|-----------|-------------|
| `sse:connected` | `url` | Connection established |
| `sse:disconnected` | `url` | Connection closed |
| `sse:message` | `event, html` | Message received |
| `render:success` | `event, html` | HTML rendered successfully |
| `render:failed` | `event, html` | Render failed (no root element) |
| `sse:error` | `error` | Connection error |

### Live Data with useMercureTopic

For simple live values (like notification counts, user status), use the `useMercureTopic` hook to subscribe to Mercure topics that send JSON data:

```tsx
import { useMercureTopic } from 'react-htx';

// Simple types - inferred from initial value
function NotificationBadge() {
  const count = useMercureTopic('/notifications/count', 0);

  if (count === 0) return null;
  return <span className="badge">{count}</span>;
}

// Explicit type parameter
function UserStatus({ userId }: { userId: number }) {
  const status = useMercureTopic<'online' | 'offline' | 'away'>(
    `/user/${userId}/status`,
    'offline'
  );
  return <span className={status}>{status}</span>;
}

// Complex types with interfaces
interface DashboardStats {
  visitors: number;
  sales: number;
  conversion: number;
}

function Dashboard() {
  const stats = useMercureTopic<DashboardStats>('/dashboard/stats', {
    visitors: 0,
    sales: 0,
    conversion: 0,
  });

  return (
    <div>
      <span>Visitors: {stats.visitors}</span>
      <span>Sales: {stats.sales}</span>
      <span>Conversion: {stats.conversion}%</span>
    </div>
  );
}
```

**Backend:**
```php
// Push JSON data to topic
$hub->publish(new Update(
    '/notifications/count',
    json_encode(42)
));
```

**Note:** Make sure to set `app.mercureConfig` before using `useMercureTopic`:
```typescript
const app = new App(component);
app.mercureConfig = {
  hubUrl: "/.well-known/mercure",
  withCredentials: true,
};
```

### Custom Live Regions (Partial Updates)

For partial updates (e.g., updating a sidebar across all pages), you can create your own live region component. The `mercureConfig` is accessible via `useApp()`:

**Setup:**
```typescript
import { App, Mercure, MercureLive } from 'react-htx';
import loadable from '@loadable/component';

const component = loadable(
    async ({ is }: { is: string }) => {
        // The mapping is up to you, react-htx only provides the MercureLive Component (don't lazy load it!)
        if (is === 'mercure-live') {
            return MercureLive;
        }

        // Your default implementaiton
        return import(`./components/${is}.tsx`);
    },
    {
        cacheKey: ({ is }) => is,
        resolveComponent: (mod, { is }) => {
            if (is === 'mercure-live') {
                return mod;
            }
            return mod.default || mod[is];
        }
    }
);


const app = new App(component);
const mercure = new Mercure(app);

// Store config for components to access
app.mercureConfig = {
  hubUrl: "/.well-known/mercure",
  withCredentials: true,
};
mercure.subscribe(app.mercureConfig);
```

### Beispiel: Live Sidebar

```tsx
// components/sidebar.tsx
export function Sidebar({ children }: { children: React.ReactNode }) {
  return (
    <aside className="sidebar">
      {children}
    </aside>
  );
}
```

**HTML Usage:**
```html
<div id="htx-app">
  <nav>...</nav>

  <!-- Diese Region wird live aktualisiert -->
  <mercure-live topic="/sidebar">
    <sidebar>
      <ul>
        <li>Initial menu item 1</li>
        <li>Initial menu item 2</li>
      </ul>
    </sidebar>
  </mercure-live>

  <main>...</main>
</div>
```

**Backend:**
```php
// Render die Sidebar neu
$html = $twig->render('_sidebar.html.twig', [
    'menuItems' => $updatedMenuItems
]);

// Push zu allen Clients
$hub->publish(new Update('/sidebar', $html));
```

**Template (_sidebar.html.twig):**
```twig
<sidebar>
  <ul>
    {% for item in menuItems %}
    <li>{{ item.label }}</li>
    {% endfor %}
  </ul>
</sidebar>
```

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
