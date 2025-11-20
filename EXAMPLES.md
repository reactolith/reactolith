# React-HTX Mercure Examples

Dieses Dokument zeigt, wie du Mercure Live-Updates für einzelne Components verwendest.

## Setup

### Schritt 1: Components registrieren

**Wichtig:** Die `MercureLive` Component muss in deinem Component-Loader registriert werden, genau wie alle anderen Custom Components.

```typescript
// app.ts
import { App, Mercure, MercureLive } from 'react-htx';
import loadable from '@loadable/component';

const component = loadable(
  async ({ is }: { is: string }) => {
    // MercureLive Component direkt zurückgeben (nicht lazy laden)
    if (is === 'mercure-live') {
      return MercureLive;
    }

    // Alle anderen Components lazy laden
    return import(`./components/${is}.tsx`);
  },
  {
    cacheKey: ({ is }) => is,
    // Falls deine Components benannte Exports haben
    resolveComponent: (mod, { is }) => {
      // MercureLive ist bereits die Component
      if (is === 'mercure-live') {
        return mod;
      }
      // Für andere Components: Default export oder benannten Export
      return mod.default || mod[is];
    }
  }
);

const app = new App(component);

// Mercure konfigurieren (WICHTIG für useMercureTopic und MercureLive)
app.mercureConfig = {
  hubUrl: "/.well-known/mercure",
  withCredentials: true,
};

// Optional: Ganzseitige Updates (re-subscribe bei Route-Wechsel)
const mercure = new Mercure(app);
mercure.subscribe(app.mercureConfig);
```

### Schritt 2: Alternative - Einfachere Variante

Wenn du nur wenige Components hast, kannst du auch ein simples Mapping verwenden:

```typescript
// app.ts
import { App, MercureLive } from 'react-htx';
import { NotificationBadge } from './components/notification-badge';
import { UserStatus } from './components/user-status';
import { Sidebar } from './components/sidebar';

// Einfaches Component-Mapping
const componentMap: Record<string, React.ComponentType<any>> = {
  'mercure-live': MercureLive,
  'notification-badge': NotificationBadge,
  'user-status': UserStatus,
  'sidebar': Sidebar,
};

const component = ({ is, ...props }: { is: string }) => {
  const Component = componentMap[is];
  if (!Component) {
    console.warn(`Component ${is} not found`);
    return null;
  }
  return <Component {...props} />;
};

const app = new App(component);
app.mercureConfig = {
  hubUrl: "/.well-known/mercure",
  withCredentials: true,
};
```

---

## 1. Live JSON-Daten mit `useMercureTopic`

Verwende diesen Hook für einfache Live-Werte wie Benachrichtigungszähler, Benutzerstatus, etc.

### Beispiel: Notification Badge

```tsx
// components/notification-badge.tsx
import { useMercureTopic } from 'react-htx';

export function NotificationBadge() {
  const count = useMercureTopic('/notifications/count', 0);

  if (count === 0) return null;

  return <span className="badge">{count}</span>;
}
```

**HTML Usage:**
```html
<notification-badge></notification-badge>
```

**Backend (PHP/Symfony):**
```php
$hub->publish(new Update(
    '/notifications/count',
    json_encode(42)
));
```

---

### Beispiel: User Status

```tsx
// components/user-status.tsx
import { useMercureTopic } from 'react-htx';

interface UserStatusProps {
  'user-id': number;
}

export function UserStatus({ 'user-id': userId }: UserStatusProps) {
  const status = useMercureTopic<'online' | 'offline' | 'away'>(
    `/user/${userId}/status`,
    'offline'
  );

  return (
    <span className={`status status-${status}`}>
      {status}
    </span>
  );
}
```

**HTML Usage:**
```html
<user-status user-id="123"></user-status>
```

**Backend:**
```php
$hub->publish(new Update(
    "/user/{$userId}/status",
    json_encode('online')
));
```

---

### Beispiel: Dashboard Stats

```tsx
// components/dashboard-stats.tsx
import { useMercureTopic } from 'react-htx';

interface DashboardData {
  visitors: number;
  sales: number;
  revenue: number;
  conversion: number;
}

export function DashboardStats() {
  const stats = useMercureTopic<DashboardData>('/dashboard/stats', {
    visitors: 0,
    sales: 0,
    revenue: 0,
    conversion: 0,
  });

  return (
    <div className="stats-grid">
      <div className="stat">
        <h3>Visitors</h3>
        <span className="value">{stats.visitors}</span>
      </div>
      <div className="stat">
        <h3>Sales</h3>
        <span className="value">{stats.sales}</span>
      </div>
      <div className="stat">
        <h3>Revenue</h3>
        <span className="value">€{stats.revenue}</span>
      </div>
      <div className="stat">
        <h3>Conversion</h3>
        <span className="value">{stats.conversion}%</span>
      </div>
    </div>
  );
}
```

**HTML Usage:**
```html
<dashboard-stats></dashboard-stats>
```

**Backend:**
```php
$stats = [
    'visitors' => 1234,
    'sales' => 56,
    'revenue' => 12500,
    'conversion' => 4.5,
];

$hub->publish(new Update(
    '/dashboard/stats',
    json_encode($stats)
));
```

---

## 2. Live HTML-Updates mit `MercureLive`

Verwende diese Component für komplexere Updates, bei denen du HTML-Components vom Backend rendern und live updaten möchtest.

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

### Beispiel: Live Notification Feed

```tsx
// components/notification-feed.tsx
export function NotificationFeed({ children }: { children: React.ReactNode }) {
  return (
    <div className="notification-feed">
      {children}
    </div>
  );
}

// components/notification-item.tsx
export interface NotificationItemProps {
  type: 'info' | 'success' | 'warning' | 'error';
  children: React.ReactNode;
}

export function NotificationItem({ type, children }: NotificationItemProps) {
  return (
    <div className={`notification notification-${type}`}>
      {children}
    </div>
  );
}
```

**HTML Usage:**
```html
<mercure-live topic="/notifications/feed">
  <notification-feed>
    <!-- Wird live vom Backend aktualisiert -->
  </notification-feed>
</mercure-live>
```

**Backend:**
```php
// Neue Benachrichtigung hinzufügen
$html = '<notification-feed>';
foreach ($notifications as $notification) {
    $html .= sprintf(
        '<notification-item type="%s">%s</notification-item>',
        $notification->getType(),
        $notification->getMessage()
    );
}
$html .= '</notification-feed>';

$hub->publish(new Update('/notifications/feed', $html));
```

---

### Beispiel: Live Chat Messages

```tsx
// components/chat-messages.tsx
interface Message {
  id: number;
  user: string;
  text: string;
  timestamp: string;
}

export interface ChatMessagesProps {
  'json-messages': Message[];
}

export function ChatMessages({ 'json-messages': messages }: ChatMessagesProps) {
  return (
    <div className="chat-messages">
      {messages.map(msg => (
        <div key={msg.id} className="message">
          <strong>{msg.user}:</strong> {msg.text}
          <small>{msg.timestamp}</small>
        </div>
      ))}
    </div>
  );
}
```

**HTML Usage:**
```html
<mercure-live topic="/chat/room/1">
  <chat-messages json-messages='[]'></chat-messages>
</mercure-live>
```

**Backend:**
```php
// Neue Nachricht erhalten
$messages = $chatRepository->findByRoom($roomId);
$messagesJson = json_encode($messages);

$html = sprintf(
    '<chat-messages json-messages=\'%s\'></chat-messages>',
    htmlspecialchars($messagesJson, ENT_QUOTES)
);

$hub->publish(new Update("/chat/room/{$roomId}", $html));
```

---

## 3. Verschachtelte (Nested) MercureLive Components

`MercureLive` Components können auch verschachtelt werden. Wenn das Backend ein Update pushed, das eine weitere `<mercure-live>` Component enthält, wird diese automatisch erkannt und subscribed zu ihrem eigenen Topic.

### Beispiel: Sidebar mit Live-Notifications

```tsx
// components/sidebar.tsx
export function Sidebar({ children }: { children: React.ReactNode }) {
  return (
    <aside className="sidebar">
      {children}
    </aside>
  );
}

// components/notification-list.tsx
export function NotificationList({ children }: { children: React.ReactNode }) {
  return (
    <div className="notification-list">
      {children}
    </div>
  );
}
```

**HTML Usage - Initial:**
```html
<div id="htx-app">
  <mercure-live topic="/sidebar">
    <sidebar>
      <h2>Sidebar</h2>
      <p>Loading...</p>
    </sidebar>
  </mercure-live>
</div>
```

**Backend - Sidebar Update mit nested MercureLive:**
```php
// Push ein Update zur Sidebar, das eine nested MercureLive Component enthält
$sidebarHtml = '<sidebar>
  <h2>Sidebar</h2>
  <mercure-live topic="/notifications">
    <notification-list>
      <p>No notifications</p>
    </notification-list>
  </mercure-live>
</sidebar>';

$hub->publish(new Update('/sidebar', $sidebarHtml));
```

Jetzt subscribed die App zu **zwei** Topics:
- `/sidebar` (äußere Component)
- `/notifications` (innere Component)

**Backend - Notification Update:**
```php
// Push nur ein Update für Notifications (Sidebar bleibt unverändert)
$notificationHtml = '<notification-list>
  <notification-item>New message from John</notification-item>
  <notification-item>Task completed</notification-item>
</notification-list>';

$hub->publish(new Update('/notifications', $notificationHtml));
```

### Vorteile von Nested Components

1. **Granulare Updates**: Nur die betroffene Region wird aktualisiert
2. **Unabhängige Topics**: Jede Region kann eigene Update-Frequenzen haben
3. **Weniger Datenübertragung**: Kleinere Updates statt ganzer Sidebar
4. **Automatische Verwaltung**: EventSources werden automatisch erstellt und geschlossen

### Beispiel: Dashboard mit mehreren Live-Bereichen

```html
<div id="htx-app">
  <dashboard>
    <!-- Live Stats -->
    <mercure-live topic="/dashboard/stats">
      <stats-grid>...</stats-grid>
    </mercure-live>

    <!-- Live Activity Feed -->
    <mercure-live topic="/dashboard/activity">
      <activity-feed>...</activity-feed>
    </mercure-live>

    <!-- Live Chart (kann weitere nested Components enthalten) -->
    <mercure-live topic="/dashboard/chart">
      <chart-widget>
        <!-- Backend könnte hier noch eine nested MercureLive Component pushen -->
      </chart-widget>
    </mercure-live>
  </dashboard>
</div>
```

Jedes dieser Elemente updated unabhängig, wenn das Backend ein Update published.

---

## Vergleich: `useMercureTopic` vs `MercureLive`

| Feature | useMercureTopic | MercureLive |
|---------|----------------|-------------|
| **Datenformat** | JSON | HTML |
| **Rendering** | React Component | Backend Template |
| **Use Case** | Einfache Daten (Zähler, Status) | Komplexe UI (Listen, Feeds) |
| **Performance** | Sehr schnell | Schnell |
| **Backend Logic** | Minimal | Template Rendering |
| **Komplexität** | Niedrig | Mittel |

---

## Best Practices

### 1. Mercure Config immer setzen

```typescript
// ✅ Richtig
const app = new App(component);
app.mercureConfig = {
  hubUrl: "/.well-known/mercure",
  withCredentials: true,
};
```

### 2. Fehlerbehandlung

```typescript
// Backend error handling
try {
  $hub->publish(new Update($topic, $data));
} catch (Exception $e) {
  $logger->error('Mercure publish failed', ['error' => $e->getMessage()]);
}
```

### 3. Topic-Naming Convention

```
✅ Empfohlen:
/notifications/count
/user/{id}/status
/dashboard/stats
/chat/room/{id}

❌ Nicht empfohlen:
notifications_count
user_status_123
stats
chat1
```

### 4. Security

Stelle sicher, dass dein Mercure Hub korrekt authentifiziert ist:

```yaml
# config/packages/mercure.yaml
mercure:
    hubs:
        default:
            url: '%env(MERCURE_URL)%'
            jwt:
                secret: '%env(MERCURE_JWT_SECRET)%'
                publish: ['*']
                subscribe: ['*'] # In Produktion: Spezifische Topics
```

---

## Troubleshooting

### "app.mercureConfig is not set"

```typescript
// Lösung: Config vor dem Hook-Aufruf setzen
const app = new App(component);
app.mercureConfig = { hubUrl: "...", withCredentials: true };
```

### EventSource Fehler

Prüfe:
1. Ist der Mercure Hub erreichbar?
2. Stimmt die `hubUrl`?
3. Sind CORS-Headers korrekt gesetzt?
4. Ist die JWT korrekt?

```bash
# Test Mercure Hub
curl -N "http://localhost:3000/.well-known/mercure?topic=/test"
```

### Updates kommen nicht an

1. **Topic stimmt überein** - Frontend und Backend müssen exakt denselben Topic verwenden
2. **HTML Format** - MercureLive erwartet gültiges HTML
3. **JSON Format** - useMercureTopic erwartet gültiges JSON

```php
// ✅ Richtig
$hub->publish(new Update('/notifications/count', json_encode(42)));

// ❌ Falsch
$hub->publish(new Update('/notifications/count', '42')); // Nicht als JSON
```

---

## FAQ

### Wie registriere ich MercureLive in meiner App?

Die `MercureLive` Component muss in deinem Component-Loader registriert werden. Siehe [Setup](#setup) für Details.

**Kurze Antwort:**
```typescript
import { MercureLive } from 'react-htx';

const component = loadable(async ({ is }) => {
  if (is === 'mercure-live') return MercureLive;
  return import(`./components/${is}.tsx`);
});
```

### Was passiert, wenn in einem Mercure-Update eine weitere MercureLive Component enthalten ist?

Das funktioniert automatisch! Wenn dein Backend HTML pushed, das eine `<mercure-live>` Component enthält, wird diese:

1. **Automatisch erkannt** durch das HTX Component-System
2. **Gerendert** mit ihrem eigenen `topic` Prop
3. **Subscribed** zu ihrem eigenen EventSource
4. **Unabhängig verwaltet** - Updates gehen nur an die jeweilige Component

**Beispiel:**
```php
// Backend pushed dieses HTML zum Topic "/sidebar"
$html = '<sidebar>
  <h2>Menü</h2>
  <mercure-live topic="/notifications">
    <notification-list>...</notification-list>
  </mercure-live>
</sidebar>';

$hub->publish(new Update('/sidebar', $html));
```

Jetzt hast du **zwei** aktive EventSource-Verbindungen:
- Eine für `/sidebar`
- Eine für `/notifications`

Beide können unabhängig voneinander aktualisiert werden.

### Kann ich MercureLive und useMercureTopic gleichzeitig verwenden?

Ja! Du kannst beide gleichzeitig verwenden:

```tsx
function Dashboard() {
  // JSON-Daten via useMercureTopic
  const userCount = useMercureTopic('/stats/users', 0);

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Online users: {userCount}</p>

      {/* HTML-Updates via MercureLive */}
      <mercure-live topic="/activity-feed">
        <activity-feed>...</activity-feed>
      </mercure-live>
    </div>
  );
}
```

### Wie viele EventSource-Verbindungen werden erstellt?

Pro `MercureLive` Component wird **eine** EventSource-Verbindung erstellt. Beispiel:

- 1× `<mercure-live topic="/sidebar">` = 1 Verbindung
- 3× `<mercure-live topic="/...">` auf einer Seite = 3 Verbindungen
- 1× `Mercure.subscribe()` (ganzseitige Updates) = 1 Verbindung
- 5× `useMercureTopic()` = 5 Verbindungen

**Best Practice:** Verwende `MercureLive` für HTML-Regions und `useMercureTopic` für einzelne Werte. Vermeide zu viele gleichzeitige Verbindungen.

### Werden EventSources automatisch geschlossen?

Ja! Wenn eine `MercureLive` Component unmounted (z.B. bei Navigation), wird die EventSource automatisch geschlossen. Du musst dich nicht um das Cleanup kümmern.

---

## Weitere Ressourcen

- [Mercure Dokumentation](https://mercure.rocks/)
- [Symfony Mercure Bundle](https://symfony.com/bundles/MercureBundle/current/index.html)
- [React HTX README](./README.md)
