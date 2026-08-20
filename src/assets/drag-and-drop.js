let fileInput = null;
let uploadBox = null;
let preview = null;
let uploadContent = null;
let uploadLabel = null;

console.log("drag-and-drop.js loaded");

export function init(targetElement) {
    fileInput = targetElement.querySelector('#picture');
    uploadBox = targetElement.querySelector('#uploadBox');
    preview = targetElement.querySelector('#preview');
    uploadContent = targetElement.querySelector('#uploadContent');
    uploadLabel = targetElement.querySelector('.upload-label');

    console.log("uploadbox: ", uploadBox);

    fileInput.addEventListener("change", handleFile);
    
    uploadBox.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadLabel.classList.add("dragover");
    });
    
    uploadBox.addEventListener("dragleave", () => {
        uploadLabel.classList.remove("dragover");
    });
    
    uploadBox.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadLabel.classList.remove("dragover");
    
        const file = e.dataTransfer.files[0];
        if (file) {
            fileInput.files = e.dataTransfer.files;
            showPreview(file);
        }
    });
};


function handleFile() {
    const file = fileInput.files[0];
    if (file) {
        showPreview(file);
    }
}

function showPreview(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
        preview.src = e.target.result;
        preview.classList.remove("hidden");
        uploadContent.classList.add("hidden");
    };

    reader.readAsDataURL(file);
}

export function showLoadedpreview(imageUrl) {
    if (!imageUrl) return;
    preview.src = imageUrl;
    preview.classList.remove("hidden");
    uploadContent.classList.add("hidden");
}
