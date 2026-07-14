import { closeRecipe, expandRecipe } from "./recipes.js";

let currentExpanded = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log("popstate.js loaded");
});

export function setCurrentExpanded(expanded) {
    currentExpanded = expanded;
}

// Popstate listener
window.addEventListener('popstate', (event) => {
    console.log("current expanded", currentExpanded)
    console.log("POPSTATE FIRED");
    console.log("event state ", event.state);
    console.log("current url ", window.location.pathname);
    if (event.state && event.state.type === 'recipe') {
        currentExpanded = 'recipe';
        console.log("opening recipe modal");
        expandRecipe(event.state.slug);
    }
    // else if (event.state && event.state.type === 'user') {
    //     console.log("current expanded", currentExpanded)
    //     console.log("opening user modal");
    //     loadUser(event.state.slug);
    // }
    else {
        switch (currentExpanded) {
            case 'recipe':
                console.log("closing recipe modal");
                closeRecipe();
                currentExpanded = null;
                break;
            // case 'user':
            //     console.log("closing user modal");
            //     closeUser();
            //     currentExpanded = null;
            //     break;
            default:
                console.log("No modal to close");
        }
    }
});