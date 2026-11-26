let input;
let button;
const selectedCourses = new Set();
let courseContainer = null;

window.metadata = {
    courseTypes: new Map()
};

document.addEventListener('DOMContentLoaded', async () => {
    initTags();
    initListners();
    await loadTags();
    window.metadata.loaded = true;   // modules imported later check this instead of waiting for the event
    document.dispatchEvent(new Event("tagsLoaded"));
});

async function loadTags() {
    const res = await fetch('/api/meta_data.php');
    const metadata = await res.json();

    metadata.courseTypes.forEach(courseType => {
        window.metadata.courseTypes.set(courseType.id, courseType);
    });

    renderRecipeMetaData(metadata);
}

function initTags() {
    input = document.getElementById('newTag');
    button = document.getElementById('addTag');
}

function renderRecipeMetaData(metadata) {

    const courseDropdown = document.querySelectorAll('.course-dropdown');
    const courseTypesContainer = document.querySelectorAll('.course-types-container');

    const courseTypes = metadata.courseTypes || [];

    console.log("course dropdown", courseDropdown);

    if (courseDropdown.length > 0) {
        courseTypes.forEach(tag => {
            let element = createMetaElement(tag, courseTypesContainer[0], "course");
            // element.addEventListener('click', (evt) => {
            //     toggleCourseType(element, evt.currentTarget.closest('fieldset'));
            // });
            let option = document.createElement('option');
            option.value = tag.id;
            option.textContent = tag.name;
            courseDropdown[0].appendChild(option);
        });
    }
}

function createMetaElement(tag, container, className) {
    const element = document.createElement('span');
    element.className = "pill " + className;
    element.textContent = tag.name;
    element.dataset.id = tag.id;

    container.appendChild(element);
    return element;
}

// function toggleCourseType(element, fieldset) {
//     let activeCourceType = fieldset.querySelector('.course.selected');
//     if (activeCourceType) {
//         activeCourceType.classList.remove('selected');
//     }
//     element.classList.add('selected');
//     fieldset.querySelector('#selected-course').value = element.dataset.id;
// }

function submitTag() {
    const name = input.value.trim();
    if (!name) return;

    fetch('/api/tags.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name })
    }).then(res => res.json()).then(tag => { 
        renderTag(tag, true);
        input.value = '';
    });
}


function renderCourseSelection() {
    document.getElementById('selected-course').value = [...selectedCourses].join(',');
    courseContainer?.querySelectorAll('[data-id]').forEach(el => {
        const on = selectedCourses.has(el.dataset.id);
        el.classList.toggle('selected', on);
        el.setAttribute('aria-pressed', String(on));
    });
}

function initListners() {
    if (input) {
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitTag();
            }
        });
        input.addEventListener('blur', submitTag);
        button.addEventListener('click', submitTag);
    }

    courseContainer = document.querySelector('.course-types-container');
    
    courseContainer?.addEventListener('click', e => {
        const chip = e.target.closest('[data-id]');
        if (!chip) return;
        const id = chip.dataset.id;
        selectedCourses.has(id) ? selectedCourses.delete(id) : selectedCourses.add(id);
        renderCourseSelection();
    });
}