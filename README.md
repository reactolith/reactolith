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

## 📡 Real-time Updates with Mercure

`react-htx` supports **Server-Sent Events (SSE)** via [Mercure](https://mercure.rocks/) for real-time updates from your backend. When the server publishes an update, the HTML is automatically rendered — just like with router navigation.

```typescript
import { App, Mercure } from "react-htx";

const app = new App(component);
const mercure = new Mercure(app);

// Subscribe to Mercure hub
mercure.subscribe({
  hubUrl: "https://example.com/.well-known/mercure",
  topics: ["/updates/dashboard", "/notifications"],
  withCredentials: true,  // Include cookies for authentication
});

// Listen to events
mercure.on("sse:connected", (url) => {
  console.log("Connected to Mercure hub");
});

mercure.on("render:success", (event, html) => {
  console.log("UI updated from server push");
});

mercure.on("sse:error", (error) => {
  console.error("Connection error, will retry...");
});

// Close connection when done
mercure.close();
```

### Mercure Events

| Event | Arguments | Description |
|-------|-----------|-------------|
| `sse:connected` | `url` | Connection established |
| `sse:disconnected` | `url` | Connection closed |
| `sse:message` | `event, html` | Message received |
| `render:success` | `event, html` | HTML rendered successfully |
| `render:failed` | `event, html` | Render failed (no root element) |
| `sse:error` | `error` | Connection error |

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

## 🎯 Full Symfony Example

Here's a complete example showing how to use `react-htx` with Symfony, including Mercure for real-time updates.

### Backend (Symfony)

**Install Mercure Bundle:**
```bash
composer require symfony/mercure-bundle
```

**Controller:**
```php
// src/Controller/DashboardController.php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Mercure\Update;
use Symfony\Component\Routing\Annotation\Route;

class DashboardController extends AbstractController
{
    #[Route('/dashboard', name: 'dashboard')]
    public function index(): Response
    {
        return $this->render('dashboard/index.html.twig', [
            'tasks' => $this->getTaskRepository()->findAll(),
            'stats' => $this->getStats(),
        ]);
    }

    #[Route('/task/complete/{id}', name: 'task_complete', methods: ['POST'])]
    public function completeTask(int $id, HubInterface $hub): Response
    {
        $task = $this->getTaskRepository()->find($id);
        $task->setCompleted(true);
        $this->entityManager->flush();

        // Push update to all connected clients
        $html = $this->renderView('dashboard/_task_list.html.twig', [
            'tasks' => $this->getTaskRepository()->findAll(),
        ]);

        $update = new Update(
            '/dashboard/tasks',  // Topic
            $html                // HTML payload
        );
        $hub->publish($update);

        return new Response('OK');
    }

    #[Route('/notification/send', name: 'send_notification', methods: ['POST'])]
    public function sendNotification(HubInterface $hub): Response
    {
        $html = $this->renderView('components/_notification.html.twig', [
            'message' => 'New task assigned to you!',
            'type' => 'info',
        ]);

        $update = new Update('/notifications', $html);
        $hub->publish($update);

        return new Response('OK');
    }
}
```

**Templates:**

```twig
{# templates/dashboard/index.html.twig #}
{% extends 'base.html.twig' %}

{% block body %}
<div id="htx-app">
    <ui-layout>
        <header slot="header">
            <ui-navbar>
                <a href="{{ path('dashboard') }}">Dashboard</a>
                <a href="{{ path('settings') }}">Settings</a>
            </ui-navbar>
        </header>

        <main>
            <h1>Dashboard</h1>

            <ui-stats-grid json-stats='{{ stats|json_encode }}'>
            </ui-stats-grid>

            <ui-card>
                <h2 slot="header">Tasks</h2>
                <ui-task-list json-tasks='{{ tasks|json_encode }}'>
                    {% for task in tasks %}
                    <div slot="task-{{ task.id }}">
                        <ui-checkbox
                            {% if task.completed %}checked{% endif %}
                            data-task-id="{{ task.id }}"
                        >
                            {{ task.title }}
                        </ui-checkbox>
                    </div>
                    {% endfor %}
                </ui-task-list>
            </ui-card>

            <ui-notification-area>
            </ui-notification-area>
        </main>
    </ui-layout>
</div>
{% endblock %}
```

```twig
{# templates/dashboard/_task_list.html.twig #}
{# Partial template for Mercure updates #}
<div id="htx-app">
    <ui-task-list json-tasks='{{ tasks|json_encode }}'>
        {% for task in tasks %}
        <div slot="task-{{ task.id }}">
            <ui-checkbox
                {% if task.completed %}checked{% endif %}
                data-task-id="{{ task.id }}"
            >
                {{ task.title }}
            </ui-checkbox>
        </div>
        {% endfor %}
    </ui-task-list>
</div>
```

```twig
{# templates/components/_notification.html.twig #}
<div id="htx-app">
    <ui-toast type="{{ type }}" json-visible="true">
        {{ message }}
    </ui-toast>
</div>
```

### Frontend (TypeScript/React)

**Main Entry:**
```typescript
// assets/app.ts
import { App, Mercure } from 'react-htx';
import loadable from '@loadable/component';

const component = loadable(
    async ({ is }: { is: string }) => {
        const name = is.substring(3); // Remove 'ui-' prefix
        return import(`./components/${name}.tsx`);
    },
    {
        cacheKey: ({ is }) => is,
        resolveComponent: (mod, { is }) => {
            const componentName = is
                .substring(3)
                .split('-')
                .map(s => s.charAt(0).toUpperCase() + s.slice(1))
                .join('');
            return mod[componentName] || mod.default;
        },
    }
);

// Initialize app
const app = new App(component);

// Setup Mercure for real-time updates
const mercure = new Mercure(app);

// Get hub URL from meta tag (set by Symfony)
const hubUrl = document.querySelector('meta[name="mercure-hub"]')?.getAttribute('content');

if (hubUrl) {
    mercure.subscribe({
        hubUrl,
        topics: ['/dashboard/tasks', '/notifications'],
        withCredentials: true,
    });

    mercure.on('sse:connected', () => {
        console.log('Real-time updates connected');
    });

    mercure.on('render:success', (event) => {
        console.log('UI updated:', event.lastEventId);
    });

    mercure.on('sse:error', () => {
        console.warn('Connection lost, reconnecting...');
    });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    mercure.close();
});
```

**Components:**

```tsx
// assets/components/task-list.tsx
import { ReactNode } from 'react';

interface Task {
    id: number;
    title: string;
    completed: boolean;
}

interface TaskListProps {
    tasks: Task[];
    children?: ReactNode;
    [key: `task-${number}`]: ReactNode;
}

export function TaskList({ tasks, ...slots }: TaskListProps) {
    const handleComplete = async (taskId: number) => {
        await fetch(`/task/complete/${taskId}`, { method: 'POST' });
        // UI will update automatically via Mercure
    };

    return (
        <ul className="task-list">
            {tasks.map(task => (
                <li key={task.id} onClick={() => handleComplete(task.id)}>
                    {slots[`task-${task.id}`]}
                </li>
            ))}
        </ul>
    );
}
```

```tsx
// assets/components/toast.tsx
import { ReactNode, useEffect, useState } from 'react';

interface ToastProps {
    type: 'info' | 'success' | 'error';
    visible: boolean;
    children: ReactNode;
}

export function Toast({ type, visible, children }: ToastProps) {
    const [show, setShow] = useState(visible);

    useEffect(() => {
        if (visible) {
            setShow(true);
            const timer = setTimeout(() => setShow(false), 5000);
            return () => clearTimeout(timer);
        }
    }, [visible]);

    if (!show) return null;

    return (
        <div className={`toast toast-${type}`}>
            {children}
        </div>
    );
}
```

```tsx
// assets/components/checkbox.tsx
import { ReactNode } from 'react';

interface CheckboxProps {
    checked?: boolean;
    'data-task-id'?: string;
    children: ReactNode;
}

export function Checkbox({ checked, children, ...props }: CheckboxProps) {
    return (
        <label className="checkbox">
            <input
                type="checkbox"
                defaultChecked={checked}
                {...props}
            />
            <span>{children}</span>
        </label>
    );
}
```

### Symfony Configuration

```yaml
# config/packages/mercure.yaml
mercure:
    hubs:
        default:
            url: '%env(MERCURE_URL)%'
            public_url: '%env(MERCURE_PUBLIC_URL)%'
            jwt:
                secret: '%env(MERCURE_JWT_SECRET)%'
                publish: ['*']
                subscribe: ['*']
```

```twig
{# templates/base.html.twig #}
<!DOCTYPE html>
<html>
<head>
    <meta name="mercure-hub" content="{{ mercure_public_url }}">
    {{ encore_entry_link_tags('app') }}
</head>
<body>
    {% block body %}{% endblock %}
    {{ encore_entry_script_tags('app') }}
</body>
</html>
```

### How It Works

1. **Initial Load**: Symfony renders HTML with Twig, `react-htx` hydrates it into React components
2. **Navigation**: Clicking links fetches new HTML via AJAX, React reconciles the differences
3. **Real-time**: Mercure pushes HTML updates from server, UI updates automatically
4. **State Preserved**: React component state survives both navigation and real-time updates

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
