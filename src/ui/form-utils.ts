export async function findFormElementWithRetry(
        fileId: string,
        maxRetries: number = 3
): Promise<HTMLFormElement | null> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
                const editorElement = document.querySelector(
                        `div.file-editor[data-id="${fileId}"]`
                );
                if (!editorElement) {
                        console.warn(`Attempt ${attempt}: File editor not found for ${fileId}`);
                        if (attempt === maxRetries) {
                                const allEditorElements = document.querySelectorAll(
                                        "div.file-editor[data-id]"
                                );
                                console.error(
                                        `Available file editor elements: ${Array.from(allEditorElements)
                                                .map((el) => el.getAttribute("data-id"))
                                                .join(", ")}`
                                );
                                return null;
                        }
                        await new Promise((resolve) => setTimeout(resolve, 100));
                        continue;
                }

                const formElement = editorElement.querySelector("form") as HTMLFormElement | null;
                if (!formElement) {
                        console.warn(`Attempt ${attempt}: Form not found for ${fileId}`);
                        if (attempt === maxRetries) {
                                const children = Array.from(editorElement.children);
                                console.error(
                                        `File editor container children: ${children
                                                .map((c) => `${c.tagName}.${c.className}`)
                                                .join(", ")}`
                                );
                                return null;
                        }
                        await new Promise((resolve) => setTimeout(resolve, 100));
                        continue;
                }

                console.log(`Form found for ${fileId} on attempt ${attempt}`);
                return formElement;
        }
        return null;
}
