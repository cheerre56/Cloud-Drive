const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const { rimraf } = require('rimraf');

const app = express();
const PORT = 3000;

// 將一些 fs 函數轉換為 Promise 版本
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);

// 為 rimraf 創建一個 Promise 版本
const rimrafAsync = (path) => rimraf(path);

// 設置文件存儲位置，保留原始文件名
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const folder = req.body.folder || '';
        const uploadPath = path.join(__dirname, 'uploads', folder);
        fs.mkdirSync(uploadPath, { recursive: true }); // 確保目錄存在
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, originalName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 限制文件大小為10MB
});

// 確保上傳目錄存在
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
    fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
}

// 提供靜態文件
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/icons', express.static(path.join(__dirname, 'public', 'icons')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 文件上傳路由
app.post('/upload', upload.array('file'), (req, res) => {
    console.log('接收到上傳請求');
    console.log('文件:', req.files);
    console.log('文件夾:', req.body.folder);
    if (req.files && req.files.length > 0) {
        console.log('文件上傳成功');
        res.send('文件上傳成功');
    } else {
        console.log('沒有文件被上傳');
        res.status(400).send('沒有文件被上傳');
    }
});

// 檢查文件是否存在路由
app.get('/check-file/:folder?/:filename', (req, res) => {
    const folder = req.params.folder || '';
    const file = path.join(__dirname, 'uploads', folder, req.params.filename);
    fs.access(file, fs.constants.F_OK, (err) => {
        if (err) {
            return res.status(404).json({ exists: false });
        }
        res.json({ exists: true });
    });
});

// 獲取文件列表路由
app.get('/files', async (req, res) => {
    try {
        const folder = req.query.folder || '';
        const folderPath = path.join(__dirname, 'uploads', folder);
        const files = await readdirAsync(folderPath, { withFileTypes: true });
        const fileList = files.map(file => ({
            name: file.name,
            isDirectory: file.isDirectory()
        }));
        res.json(fileList);
    } catch (error) {
        console.error('讀取文件列表錯誤:', error);
        res.status(500).send('無法讀取文件列表');
    }
});

// 文件下載路由
app.get('/download/:folder?/:filename', (req, res) => {
    const folder = req.params.folder || '';
    const file = path.join(__dirname, 'uploads', folder, req.params.filename);
    res.download(file, err => {
        if (err) {
            console.error('文件下載錯誤:', err);
            res.status(500).send('文件下載錯誤');
        }
    });
});

// 文件或目錄刪除路由
app.delete('/delete-item/:folder?/:filename', async (req, res) => {
    const folder = req.params.folder || '';
    const itemPath = path.join(__dirname, 'uploads', folder, req.params.filename);
    const isDirectory = req.body.isDirectory;

    try {
        if (isDirectory) {
            await rimrafAsync(itemPath);
            res.send('目錄已刪除');
        } else {
            await fs.promises.unlink(itemPath);
            res.send('文件已刪除');
        }
    } catch (err) {
        console.error('刪除錯誤:', err);
        res.status(500).send('刪除錯誤');
    }
});

// 文件重命名路由
app.post('/rename-file', (req, res) => {
    const { folder, oldName, newName } = req.body;
    const oldPath = path.join(__dirname, 'uploads', folder, oldName);
    const newPath = path.join(__dirname, 'uploads', folder, newName);
    fs.rename(oldPath, newPath, err => {
        if (err) {
            console.error('文件重命名錯誤:', err);
            return res.status(500).send('文件重命名錯誤');
        }
        res.send('文件已重命名');
    });
});

// 創建文件夾路由
app.post('/create-folder', (req, res) => {
    const { folder, newFolder } = req.body;
    const newFolderPath = path.join(__dirname, 'uploads', folder, newFolder);
    fs.mkdir(newFolderPath, { recursive: true }, err => {
        if (err) {
            console.error('創建文件夾錯誤:', err);
            return res.status(500).send('創建文件夾錯誤');
        }
        res.send('文件夾已創建');
    });
});

// 搜索文件函數
async function searchFiles(dir, searchTerm) {
    let results = [];
    const files = await readdirAsync(dir);
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = await statAsync(filePath);
        
        if (stat.isDirectory()) {
            results = results.concat(await searchFiles(filePath, searchTerm));
        } else if (file.toLowerCase().includes(searchTerm.toLowerCase())) {
            results.push(path.relative(path.join(__dirname, 'uploads'), filePath));
        }
    }
    
    return results;
}

// 搜索文件路由
app.get('/search', async (req, res) => {
    try {
        const searchTerm = req.query.term;
        const results = await searchFiles(path.join(__dirname, 'uploads'), searchTerm);
        res.json(results);
    } catch (error) {
        console.error('搜索錯誤:', error);
        res.status(500).send('搜索錯誤');
    }
});

app.listen(PORT, () => {
    console.log(`服務器運行在 http://localhost:${PORT}`);
});

app.get('/file-properties/:folder?/:filename', async (req, res) => {
    try {
        const folder = req.params.folder || '';
        const filePath = path.join(__dirname, 'uploads', folder, req.params.filename);
        const stats = await fs.promises.stat(filePath);
        const properties = {
            name: req.params.filename,
            path: path.join(folder, req.params.filename),
            size: stats.size,
            uploadTime: stats.mtime
        };
        res.json(properties);
    } catch (error) {
        console.error('獲取文件屬性錯誤:', error);
        res.status(500).send('無法獲取文件屬性');
    }
});
