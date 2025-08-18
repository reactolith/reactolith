import { App } from "./App";
import {Href, RouterOptions} from "@react-types/shared";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export class Router {

    private readonly app : App
    private readonly fetch : FetchLike

    constructor(
        app : App,
        doc : Document = document,
        fetchImpl : FetchLike = globalThis.fetch,
    ) {
        this.app = app
        this.fetch = fetchImpl

        if(doc.defaultView) {
            doc.defaultView.addEventListener('popstate', async () => {
                await this.visit(location.pathname + location.search, { method: 'GET' }, false)
            })
        }

        doc.addEventListener('click', async (event) => {
            const link = (event.target as HTMLElement).closest('a')
            if(!link) {
                return
            }
            const href = link.getAttribute('href')
            if(!href || href.startsWith('http') || href.startsWith('#') || link.target === '_blank') {
                return
            }
            event.preventDefault()
            await this.visit(href)
        })

        doc.addEventListener('submit', async (event) => {

            const form = event.target as HTMLFormElement
            if (!form.action || form.target === "_blank") {
                return
            }

            event.preventDefault()
            const formData = new FormData(form)
            const method = (form.method || "GET").toUpperCase()
            let body: BodyInit | null = null
            let url = form.action

            if (method === "GET") {
                const params = new URLSearchParams(formData as any).toString();
                url = url.includes("?") ? `${url}&${params}` : `${url}?${params}`;
            } else {
                body = formData;
            }

            await this.visit(url, { method, body })
        })
    }

    async visit(input : URL | string, init : RequestInit = { method: 'GET' }, pushState : boolean = true) : Promise<boolean> {
        const response = await this.fetch(input, init)
        const html = await response.text()

        if(pushState) {
            history.pushState({}, '', input)
        }

        return this.app.render(html)
    }

    async navigate(path: Href, _: RouterOptions | undefined) : Promise<void> {
        await this.visit(path)
    }
}
