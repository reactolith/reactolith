import {createRoot, Root} from "react-dom/client";
import React, {ElementType} from "react";
import {RootComponent} from "./RootComponent";
import {Router} from "./Router";

export class App {
    public readonly router : Router
    private readonly rootComponent : ElementType
    private readonly component : ElementType
    private readonly selector : (doc : Document) => HTMLElement | null
    private readonly root : Root

    constructor(
        component : ElementType,
        rootComponent : ElementType = RootComponent,
        selector : ((doc : Document) => HTMLElement | null) | string = '#htx-app',
        root? : Root,
        doc : Document = document,
    ) {
        this.router = new Router(this, doc)
        this.component = component
        this.rootComponent = rootComponent

        if (typeof selector === 'string') {
            const selStr = selector
            selector = (doc) => doc.querySelector(selStr)
        }
        this.selector = selector

        const element = this.selector(doc)
        if(!element) {
            throw new Error('Could not find root element in document. Please check your selector!')
        }

        this.root = root || createRoot(element)
        this.renderElement(element)
    }

    public render(document : string | Document) : boolean {
        if(typeof document === 'string') {
            const parser = new DOMParser()
            document = parser.parseFromString(document, 'text/html')
        }

        // Try to find the root element in the document
        const element = this.selector(document)

        if(!element) {
            return false
        }

        this.renderElement(element)

        return true
    }

    public renderElement(element : HTMLElement) : void {
        this.root.render(React.createElement(
            this.rootComponent,
            {
                app: this,
                element,
                component: this.component,
            }
        ))
    }
}
