# Scroll Restoration Plan

## Verhalten (Defaults)

| Navigation              | Scroll-Verhalten                                    |
|-------------------------|-----------------------------------------------------|
| Link-Klick / Form       | Scroll nach oben (wie Browser bei normalem Seitenaufruf) |
| Link/Form mit Hash-URL  | Scroll zum Hash-Element (`#section`)                |
| Browser Back/Forward     | Scroll-Position wiederherstellen                    |
| Mercure-Refetch          | Position bleibt automatisch erhalten                |

## Konfiguration pro Link/Form

Da reactolith native `<a>`-Tags verwendet (kein eigenes `<Link>`-Component), erfolgt die Konfiguration per `data-scroll` Attribut:

```html
<!-- Default: scrollt nach oben -->
<a href="/page">Link</a>

<!-- Scroll-Position beibehalten -->
<a href="/page" data-scroll="preserve">Link</a>

<!-- Auch auf Forms -->
<form action="/search" data-scroll="preserve">...</form>
```

Bei Back/Forward wird `data-scroll` ignoriert - die gespeicherte Position wird immer wiederhergestellt.

## Programmatische API

```typescript
// Default: scrollt nach oben
router.navigate("/page");

// Scroll-Position beibehalten
router.navigate("/page", { scroll: "preserve" });

// visit() bekommt optionalen 4. Parameter
router.visit("/page", { method: "GET" }, true, "preserve");
```

## Scroll-Container

Default ist `window`. Konfigurierbar per `data-scroll-container` auf dem Root-Element (selbes Pattern wie `data-mercure-hub-url`):

```html
<div id="reactolith-app" data-scroll-container="#main-content">
  ...
</div>
```

## Technisches Design

### Neue Datei: `src/ScrollRestoration.ts`

Zuständig für:
- `history.scrollRestoration = "manual"` setzen (Browser-eigene Restoration deaktivieren)
- Pro History-Entry eine `restorationId` in `history.state` speichern
- Scroll-Positionen in einer In-Memory `Map<restorationId, {x, y}>` halten
- Bei `beforeunload` in `sessionStorage` persistieren (überlebt Page-Refresh)
- Bei Initialisierung aus `sessionStorage` hydrieren

```
class ScrollRestoration {
  positions: Map<string, {x, y}>
  currentId: string

  constructor(win, scrollContainerSelector?)
  save()                    // Aktuelle Position für currentId speichern
  push() -> {restorationId} // Neue ID generieren, für pushState
  pop()                     // currentId aus history.state lesen
  scroll(isPush, behavior?, url)  // Scroll-Aktion ausführen
}
```

**Scroll-Logik in `scroll()`:**
1. Hash in URL? → `element.scrollIntoView()` (hat Priorität)
2. Pop-Navigation (`isPush=false`)? → Gespeicherte Position wiederherstellen
3. Push mit `behavior="preserve"`? → Nichts tun
4. Push ohne Angabe? → Scroll nach oben `(0, 0)`

**ID-Generierung:** `Math.random().toString(36).slice(2)` - ausreichend einzigartig innerhalb einer Session, keine Kollisionsgefahr bei Page-Refresh.

**Scroll-Container-Abstraktion:**
- Ohne `data-scroll-container`: `window.scrollX/Y` und `window.scrollTo()`
- Mit `data-scroll-container`: `element.scrollLeft/Top` und `element.scrollTo()`

### Änderungen an `src/Router.ts`

**Constructor:** ScrollRestoration erstellen (nur wenn `doc.defaultView` existiert):
```typescript
if (doc.defaultView) {
  this.scrollRestoration = new ScrollRestoration(doc.defaultView, scrollContainerSelector);
}
```

**`visit()` - neuer 4. Parameter:**
```typescript
async visit(input, init, pushState, scroll?: "top" | "preserve")
```

Ablauf in `visit()`:
```
1. scrollRestoration.save()        // Position VOR Navigation sichern
2. emit("nav:started")
3. fetch + render
4. if pushState:
     state = scrollRestoration.push()
     history.pushState(state, "", finalUrl)    // statt history.pushState({}, ...)
   else:
     scrollRestoration.pop()
5. scrollRestoration.scroll(pushState, scroll, finalUrl)
6. emit events
```

**`onClick()`:** `data-scroll` vom Link lesen:
```typescript
const scroll = link.dataset.scroll as "top" | "preserve" | undefined;
await this.visit(hrefAttr, { method: "GET" }, true, scroll);
```

**`onSubmit()`:** `data-scroll` vom Form lesen:
```typescript
const scroll = form.dataset.scroll as "top" | "preserve" | undefined;
await this.visit(url, { method, body }, true, scroll);
```

**`navigate()`:** Options-Parameter:
```typescript
navigate(path: Href, options?: { scroll?: "top" | "preserve" }): Promise<void>
```

### Änderungen an `src/App.ts`

`data-scroll-container` vom Root-Element lesen und an Router übergeben:
```typescript
const scrollContainer = this.element.getAttribute("data-scroll-container") || undefined;
this.router = new Router(this, doc, fetchImp, scrollContainer);
```

### Änderungen an `src/index.ts`

ScrollRestoration-Typ exportieren falls nützlich.

### Neue Tests: `tests/Router.scroll.test.tsx`

1. Forward-Navigation scrollt nach oben (`window.scrollTo(0, 0)`)
2. `data-scroll="preserve"` auf Link → kein Scroll
3. `data-scroll="preserve"` auf Form → kein Scroll
4. Back-Navigation stellt Position wieder her
5. URL mit Hash → scrollt zum Element
6. `navigate()` mit `{ scroll: "preserve" }`
7. `history.state` enthält `restorationId`
8. Initiales `replaceState` setzt `restorationId`
9. sessionStorage-Persistierung und -Hydrierung
10. Custom scroll container (Element statt window)

## Warum diese Entscheidungen

- **sessionStorage + In-Memory Map** (wie React Router): Überlebt Page-Refresh, anders als Turbos reine In-Memory-Lösung
- **`data-scroll` Attribut** statt Link-Component-Prop: Passt zu reactoliths HTML-first-Philosophie (Backend rendert HTML, kein React `<Link>`)
- **Immer aktiv** (wie Turbo, nicht opt-in wie React Router `<ScrollRestoration>`): Scroll-to-Top ist das erwartete Browser-Verhalten - die aktuelle Situation (kein Scroll-Management) ist ein Bug
- **`data-scroll-container`** folgt dem bestehenden `data-mercure-hub-url` Pattern
- **Pop-Navigation immer "restore"**: `data-scroll="preserve"` wirkt nur auf Push, nicht auf Back/Forward (wie React Routers `preventScrollReset`)
