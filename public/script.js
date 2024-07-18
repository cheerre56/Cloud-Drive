const uploadForm = document.getElementById('uploadForm');
const fileInput = document.getElementById('fileInput');
const selectedFilesDiv = document.getElementById('selectedFiles');
const searchInput = document.getElementById('searchInput');
const fileListDiv = document.getElementById('fileList');
const dropZone = document.getElementById('dropZone');
const contextMenu = document.getElementById('contextMenu');
const fileListSection = document.getElementById('fileListSection');
const backButton = document.getElementById('backButton');
let currentFolder = '';
let currentFile = '';

fileInput.addEventListener('change', () => {
    displaySelectedFiles(fileInput.files);
});

uploadForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const files = fileInput.files;
    if (files.length > 0) {
        checkAndUploadFiles(files);
    }
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        displaySelectedFiles(files);
        checkAndUploadFiles(files);
    }
});

searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();
    if (query) {
        searchFiles(query);
    } else {
        fetchFiles();
    }
});

fileListSection.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (e.target.closest('.file-item')) {
        currentFile = e.target.closest('.file-item').dataset.filename;
        showContextMenu(e.pageX, e.pageY);
    }
});

document.addEventListener('click', () => {
    contextMenu.style.display = 'none';
});

document.getElementById('downloadFile').addEventListener('click', () => {
    const folderPath = currentFolder ? `/${encodeURIComponent(currentFolder)}` : '';
    window.location.href = `/download${folderPath}/${encodeURIComponent(currentFile)}`;
});

document.getElementById('openFile').addEventListener('click', () => {
    window.open(`/uploads/${encodeURIComponent(currentFolder)}/${encodeURIComponent(currentFile)}`, '_blank');
});

document.getElementById('deleteFile').addEventListener('click', () => {
    const folderPath = currentFolder ? `/${encodeURIComponent(currentFolder)}` : '';
    const fileItem = fileListDiv.querySelector(`[data-filename="${currentFile}"]`);
    const isDirectory = fileItem.classList.contains('directory');
    const itemType = isDirectory ? '目錄' : '文件';
    
    if (confirm(`確定要刪除${itemType} "${currentFile}" 嗎？${isDirectory ? '這將刪除該目錄及其所有內容！' : ''}`)) {
        fetch(`/delete-item${folderPath}/${encodeURIComponent(currentFile)}`, { 
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ isDirectory: isDirectory })
        })
        .then(response => response.text())
        .then(data => {
            alert(data);
            fetchFiles();
        })
        .catch(error => {
            console.error('Error:', error);
            alert('刪除時發生錯誤：' + error.message);
        });
    }
});

document.getElementById('renameFile').addEventListener('click', () => {
    const newName = prompt('輸入新的文件名：', currentFile);
    if (newName && newName !== currentFile) {
        const ext = currentFile.split('.').pop();
        const baseName = newName.split('.').slice(0, -1).join('.') || newName;
        const newNameWithExt = `${baseName}.${ext}`;
        fetch(`/rename-file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder: currentFolder, oldName: currentFile, newName: newNameWithExt })
        })
            .then(response => response.text())
            .then(data => {
                alert(data);
                fetchFiles();
            })
            .catch(error => {
                console.error('Error:', error);
            });
    }
});
// 在現有的代碼中找到 contextMenu 相關的部分，並添加以下代碼

document.getElementById('fileProperties').addEventListener('click', () => {
    const folderPath = currentFolder ? `/${encodeURIComponent(currentFolder)}` : '';
    fetch(`/file-properties${folderPath}/${encodeURIComponent(currentFile)}`)
        .then(response => response.json())
        .then(properties => {
            const propertiesString = `
                文件名稱：${properties.name}
                文件位置：${properties.path}
                文件大小：${formatFileSize(properties.size)}
                上傳時間：${new Date(properties.uploadTime).toLocaleString()}
            `;
            alert(propertiesString);
        })
        .catch(error => {
            console.error('獲取文件屬性錯誤:', error);
            alert('無法獲取文件屬性');
        });
});

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
    else return (bytes / 1073741824).toFixed(2) + ' GB';
}



const createFolderBtn = document.getElementById('createFolderBtn');

createFolderBtn.addEventListener('click', () => {
    const folderName = prompt('請輸入新文件夾名稱：');
    if (folderName) {
        fetch('/create-folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder: currentFolder, newFolder: folderName })
        })
        .then(response => response.text())
        .then(data => {
            alert(data);
            fetchFiles();
        })
        .catch(error => {
            console.error('Error:', error);
            alert('創建文件夾時發生錯誤');
        });
    }
});


backButton.addEventListener('click', () => {
    const lastSlashIndex = currentFolder.lastIndexOf('/');
    if (lastSlashIndex !== -1) {
        currentFolder = currentFolder.substring(0, lastSlashIndex);
    } else {
        currentFolder = '';
    }
    fetchFiles();
});

function showContextMenu(x, y) {
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
}

function displaySelectedFiles(files) {
    selectedFilesDiv.innerHTML = '';
    for (const file of files) {
        const fileItem = document.createElement('div');
        fileItem.textContent = file.name;
        selectedFilesDiv.appendChild(fileItem);
    }
}

function checkAndUploadFiles(files) {
    const formData = new FormData();
    formData.append('folder', currentFolder);
    let fileIndex = 0;

    function checkNextFile() {
        if (fileIndex < files.length) {
            const file = files[fileIndex];
            const folderPath = currentFolder ? `/${encodeURIComponent(currentFolder)}` : '';
            fetch(`/check-file${folderPath}/${encodeURIComponent(file.name)}`)
                .then(response => response.json())
                .then(data => {
                    if (data.exists) {
                        const overwrite = confirm(`文件 "${file.name}" 已經存在，是否覆蓋？`);
                        if (overwrite) {
                            formData.append('file', file);
                        }
                    } else {
                        formData.append('file', file);
                    }
                    fileIndex++;
                    checkNextFile();
                })
                .catch(error => {
                    console.error('Error:', error);
                    fileIndex++;
                    checkNextFile();
                });
        } else {
            uploadFile(formData);
        }
    }

    checkNextFile();
}

function uploadFile(formData) {
    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
    })
    .then(data => {
        alert('文件上傳完成');
        fetchFiles();
        fileInput.value = '';
        selectedFilesDiv.innerHTML = '尚未選擇文件';
    })
    .catch(error => {
        console.error('Error:', error);
        alert('上傳文件時發生錯誤：' + error.message);
    });
}

function fetchFiles(query = '') {
    fetch(`/files?folder=${encodeURIComponent(currentFolder)}`)
    .then(response => response.json())
    .then(files => {
        const filteredFiles = files.filter(file => file.name.toLowerCase().includes(query.toLowerCase()));
        filteredFiles.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });
        displayFiles(filteredFiles);
        backButton.style.display = currentFolder ? 'block' : 'none';
        document.getElementById('currentFolderName').textContent = currentFolder ? `當前資料夾: ${currentFolder}` : '根目錄';
    });
}

function getFileIcon(file) {
    if (file.isDirectory) {
        return 'folder.png';
    }
    const ext = file.name.split('.').pop().toLowerCase();
    switch (ext) {
        case 'ai':
            return 'ai.png';
        case 'dwg':
            return 'dwg.png';
        case 'xls':
        case 'xlsx':
            return 'excel.png';
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
            return 'img.png';
        case 'pdf':
            return 'pdf.png';
        case 'ppt':
        case 'pptx':
            return 'ppt.png';
        case 'doc':
        case 'docx':
            return 'word.png';
        default:
            return 'document.png';
    }
}

function displayFiles(files) {
    fileListDiv.innerHTML = '';
    files.forEach(file => {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'file-item';
        if (file.isDirectory) {
            fileDiv.classList.add('directory');
        }
        fileDiv.dataset.filename = file.name;

        const fileIcon = document.createElement('img');
        fileIcon.src = `/icons/${getFileIcon(file)}`;
        fileIcon.alt = 'File Icon';

        const fileName = document.createElement('span');
        fileName.textContent = file.name;

        fileDiv.appendChild(fileIcon);
        fileDiv.appendChild(fileName);

        if (file.isDirectory) {
            fileDiv.style.fontWeight = 'bold';
            fileDiv.addEventListener('click', () => {
                currentFolder = currentFolder ? `${currentFolder}/${file.name}` : file.name;
                fetchFiles();
            });
        } else {
            fileDiv.addEventListener('dblclick', () => {
                const folderPath = currentFolder ? `/${encodeURIComponent(currentFolder)}` : '';
                window.open(`/uploads${folderPath}/${encodeURIComponent(file.name)}`, '_blank');
            });
        }

        // 添加防止選中的事件監聽器
        fileDiv.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // 左鍵
                e.preventDefault();
            }
        });

        fileListDiv.appendChild(fileDiv);
    });
}

function searchFiles(query) {
    fetch(`/search?term=${encodeURIComponent(query)}`)
    .then(response => response.json())
    .then(results => {
        displaySearchResults(results);
    })
    .catch(error => {
        console.error('搜索錯誤:', error);
    });
}

function displaySearchResults(results) {
    fileListDiv.innerHTML = '';
    results.forEach(filePath => {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'file-item';
        
        const fileName = filePath.split('/').pop();
        fileDiv.dataset.filename = fileName;

        const fileIcon = document.createElement('img');
        fileIcon.src = `/icons/${getFileIcon({name: fileName, isDirectory: false})}`;
        fileIcon.alt = 'File Icon';

        const fileNameSpan = document.createElement('span');
        fileNameSpan.textContent = filePath;

        fileDiv.appendChild(fileIcon);
        fileDiv.appendChild(fileNameSpan);

        fileDiv.addEventListener('click', () => {
            const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
            currentFolder = folderPath;
            fetchFiles();
        });

        fileListDiv.appendChild(fileDiv);
    });

    backButton.style.display = 'block';
    document.getElementById('currentFolderName').textContent = '搜索結果';
}

fetchFiles();
