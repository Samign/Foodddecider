export const ITEMS_API = '/api/shopping/shopping_items.php';
export const LISTS_API = '/api/shopping/shopping_lists.php';
const LAST_LIST_KEY = 'shopping:lastListId';

export async function request(url, { method = 'GET', query, body } = {}) {
    const fullUrl = query ? `${url}?${new URLSearchParams(query)}` : url;
    const response = await fetch(fullUrl, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined
    });
    if (!response.ok) throw new Error(`Request failed (${response.status})`);
    return response.json();
}

export function getLastListId() {
    try { return localStorage.getItem(LAST_LIST_KEY); } catch { return null; }
}

export function setLastListId(id) {
    try { localStorage.setItem(LAST_LIST_KEY, String(id)); } catch { /* storage blocked: ignore */ }
}

export function listLabel(list) {
    return list.is_owner ? list.name : `${list.name} (${list.owner_username})`;
}

export async function fetchLists() {
    return (await request(LISTS_API)).lists;
}

// The remembered list if the user still has access to it, otherwise their first list
export function pickList(lists) {
    return lists.find(list => String(list.id) === getLastListId()) ?? lists[0];
}

export function addItems(listId, texts) {
    return request(ITEMS_API, { method: 'POST', body: { action: 'add', list_id: listId, texts } });
}