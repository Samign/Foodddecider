let input;
let button;

window.metadata = {
    attributes: new Map(),
    courseTypes: new Map()
};

document.addEventListener('DOMContentLoaded', async () => {
    initTags();
    initListners();
    await loadTags();
    document.dispatchEvent(new Event("tagsLoaded"));
});

async function loadTags() {
    const res = await fetch('/api/meta_data.php');
    const metadata = await res.json();

    metadata.courseTypes.forEach(courseType => {
        window.metadata.courseTypes.set(courseType.id, courseType);
    });

    // metadata.attributes.forEach(attribute => {
    //     window.metadata.attributes.set(attribute.id, attribute);
    // });

    renderRecipeMetaData(metadata);
}

function initTags() {
    input = document.getElementById('newTag');
    button = document.getElementById('addTag');
}

function renderRecipeMetaData(metadata) {

    const attributesContainer = document.querySelectorAll('.attributes');
    const courseDropdown = document.querySelectorAll('.course-dropdown');
    const courseTypesContainer = document.querySelectorAll('.course-types-container');

    const courseTypes = metadata.courseTypes || [];
    const attributes = metadata.attributes || [];

    console.log("course dropdown", courseDropdown);

    if (courseDropdown.length > 0) {
        courseTypes.forEach(tag => {
            let element = createMetaElement(tag, courseTypesContainer[0], "course");
            element.addEventListener('click', (evt) => {
                toggleCourseType(element, evt.currentTarget.closest('fieldset'));
            });
            let option = document.createElement('option');
            option.value = tag.id;
            option.textContent = tag.name;
            courseDropdown[0].appendChild(option);
        });
    }

    
    
    attributesContainer.forEach(container => {
        attributes.forEach(tag => {
            let element = createMetaElement(tag, container, "attribute");
            element.addEventListener('click', (evt) => {
                toggleAttribute(element, evt.currentTarget.closest('fieldset'));
            });
        });
    });
}

function createMetaElement(tag, container, className) {
    const element = document.createElement('span');
    element.className = "pill " + className;
    element.textContent = tag.name;
    element.dataset.id = tag.id;

    container.appendChild(element);
    return element;
}

function toggleCourseType(element, fieldset) {
    let activeCourceType = fieldset.querySelector('.course.selected');
    if (activeCourceType) {
        activeCourceType.classList.remove('selected');
    }
    element.classList.add('selected');
    fieldset.querySelector('#selected-course').value = element.dataset.id;
}

function toggleAttribute(element, fieldset) {
    if (element.classList.contains('selected')) {
        element.classList.remove('selected');
    } else {
        element.classList.add('selected');
    }

    fieldset.querySelector('#selected-attributes').value = JSON.stringify([...fieldset.querySelectorAll('.attribute.selected')].map(el => el.dataset.id));
}

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
}