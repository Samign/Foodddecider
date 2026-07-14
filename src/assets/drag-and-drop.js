let fileInput = null;
let uploadBox = null;
let preview = null;
let uploadContent = null;
let uploadLabel = null;

document.addEventListener('DOMContentLoaded', () => {
    fileInput = document.getElementById("picture");
    uploadBox = document.getElementById("uploadBox");
    preview = document.getElementById("preview");
    uploadContent = document.getElementById("uploadContent");
    uploadLabel = document.querySelector(".upload-label");

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
});


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
