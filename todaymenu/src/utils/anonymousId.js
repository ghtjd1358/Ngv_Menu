const STORAGE_KEY = "anonymousId";

export function getOrCreateAnonymousId() {
    try {
        let id = localStorage.getItem(STORAGE_KEY);
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem(STORAGE_KEY, id);
        }
        return id;
    } catch {
        return `temp-${crypto.randomUUID()}`;
    }
}
